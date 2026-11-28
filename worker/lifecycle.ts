/**
 * DSC VIT Bhopal — Cloudflare Worker Event Lifecycle Transitions
 *
 * Authoritatively executes:
 * - 'publish': validates full criteria, sets publishedAt, updates status
 * - 'unpublish': reverts published event to draft
 * - 'archive': marks event archived, closes registrations
 *
 * Concurrency protected via Firestore currentDocument.updateTime precondition.
 * Emits audit record to /activity_logs on every state transition.
 */

import type { VerifiedUser } from "./auth.ts";
import {
  getEventDocument,
  patchEventDocument,
  recordActivityLog,
} from "./firestore.ts";
import {
  validateEventForPublish,
  type EventLike,
} from "../src/lib/shared/event-validation.ts";

export type LifecycleAction = "publish" | "unpublish" | "archive";

export interface LifecycleResult {
  success: boolean;
  eventId: string;
  title: string;
  previousStatus: string;
  newStatus: string;
  message: string;
}

export async function executeWorkerLifecycleTransition(params: {
  projectId: string;
  firestoreAccessToken: string;
  user: VerifiedUser;
  action: LifecycleAction;
  eventId: string;
}): Promise<LifecycleResult> {
  const { projectId, firestoreAccessToken, user, action, eventId } = params;

  // 1. Authoritative Role Verification
  if (user.role !== "super_admin") {
    throw new LifecycleError(
      `Permission Denied: Event lifecycle mutations require "super_admin" custom claim. Current actor role: "${user.role}".`,
      403
    );
  }

  if (!eventId || typeof eventId !== "string" || eventId.trim() === "") {
    throw new LifecycleError("Missing or invalid eventId parameter.", 400);
  }

  const validActions: LifecycleAction[] = ["publish", "unpublish", "archive"];
  if (!validActions.includes(action)) {
    throw new LifecycleError(
      `Invalid lifecycle action "${action}". Allowed: ${validActions.join(", ")}.`,
      400
    );
  }

  // 2. Fetch Event with Precondition Timestamp
  const eventDoc = await getEventDocument<EventLike & { status?: string }>(
    projectId,
    firestoreAccessToken,
    eventId
  );

  if (!eventDoc) {
    throw new LifecycleError(`Event document "/events/${eventId}" does not exist.`, 404);
  }

  const eventData = eventDoc.data;
  const currentStatus = eventData.status || "draft";
  let newStatus = currentStatus;
  const updatePayload: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  // 3. State Machine & Validation
  switch (action) {
    case "publish": {
      if (currentStatus === "published") {
        throw new LifecycleError(`Event "${eventId}" is already published.`, 409);
      }

      // Enforce strict server-side validation
      const validation = validateEventForPublish(eventData);
      if (!validation.valid) {
        throw new LifecycleError(
          `Publishing validation failed on server:\n- ${validation.errors.join("\n- ")}`,
          422,
          validation.errors
        );
      }

      newStatus = "published";
      updatePayload["status"] = "published";
      updatePayload["publishedAt"] = new Date().toISOString();
      updatePayload["isRegistrationOpen"] = true;
      break;
    }

    case "unpublish": {
      if (currentStatus !== "published") {
        throw new LifecycleError(
          `Only published events can be unpublished. Current status: "${currentStatus}".`,
          409
        );
      }

      newStatus = "draft";
      updatePayload["status"] = "draft";
      break;
    }

    case "archive": {
      if (currentStatus === "archived") {
        throw new LifecycleError(`Event "${eventId}" is already archived.`, 409);
      }

      newStatus = "archived";
      updatePayload["status"] = "archived";
      updatePayload["archivedAt"] = new Date().toISOString();
      updatePayload["isRegistrationOpen"] = false;
      break;
    }

    default:
      throw new LifecycleError(`Unknown action "${action}".`, 400);
  }

  // 4. Concurrency-Safe Patch via Precondition updateTime
  await patchEventDocument(
    projectId,
    firestoreAccessToken,
    eventId,
    updatePayload,
    eventDoc.updateTime
  );

  // 5. Server-Side Audit Log
  await recordActivityLog(projectId, firestoreAccessToken, {
    actorEmail: user.email || "super_admin@dscvitb.com",
    actorName: user.name || "Super Admin",
    actorRole: "super_admin",
    actionType: `EVENT_${action.toUpperCase()}`,
    targetModule: "Settings",
    targetEntityId: eventId,
    details: `Super Admin (${user.email}) transitioned event "${eventData.title || eventId}" from "${currentStatus}" to "${newStatus}".`,
  });

  return {
    success: true,
    eventId,
    title: eventData.title || eventId,
    previousStatus: currentStatus,
    newStatus,
    message: `Event "${eventData.title || eventId}" successfully transitioned to "${newStatus}".`,
  };
}

/**
 * Authoritatively deletes an event document from Firestore.
 * Restricted strictly to Super Admin.
 */
export async function executeWorkerEventDeletion(params: {
  projectId: string;
  firestoreAccessToken: string;
  user: VerifiedUser;
  eventId: string;
}): Promise<{ success: boolean; deletedEventId: string; message: string }> {
  const { projectId, firestoreAccessToken, user, eventId } = params;

  if (user.role !== "super_admin") {
    throw new LifecycleError("Permission Denied: Only Super Admin can delete events.", 403);
  }

  if (!eventId || typeof eventId !== "string" || eventId.trim() === "") {
    throw new LifecycleError("Missing or invalid eventId parameter.", 400);
  }

  const eventDoc = await getEventDocument<{ title?: string }>(
    projectId,
    firestoreAccessToken,
    eventId
  );

  if (!eventDoc) {
    throw new LifecycleError(`Event document "/events/${eventId}" does not exist.`, 404);
  }

  const eventData = eventDoc.data;

  // 1. Delete document via Firestore REST API
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/events/${eventId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${firestoreAccessToken}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    throw new Error(`Firestore delete failed (HTTP ${res.status}): ${errText}`);
  }

  // 2. Record audit log
  await recordActivityLog(projectId, firestoreAccessToken, {
    actorEmail: user.email || "super_admin@dscvitb.com",
    actorName: user.name || "Super Admin",
    actorRole: "super_admin",
    actionType: "EVENT_DELETE",
    targetModule: "Settings",
    targetEntityId: eventId,
    details: `Super Admin (${user.email}) permanently deleted event "${eventData.title || eventId}".`,
  });

  return {
    success: true,
    deletedEventId: eventId,
    message: `Event "${eventData.title || eventId}" was successfully deleted.`,
  };
}

export class LifecycleError extends Error {
  statusCode: number;
  details?: string[];
  constructor(message: string, statusCode = 400, details?: string[]) {
    super(message);
    this.name = "LifecycleError";
    this.statusCode = statusCode;
    this.details = details;
  }
}
