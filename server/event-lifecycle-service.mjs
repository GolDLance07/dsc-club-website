/**
 * DSC VIT Bhopal — Trusted Server-Side Event Lifecycle Service
 *
 * Authoritative lifecycle state machine and validation engine.
 * Executed ONLY in trusted server environments (Cloud Functions, Node.js server, Admin CLI).
 * Never directly bundled into or executed by client browser code.
 */

import fs from "fs";
import path from "path";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import {
  validateEventForPublish,
  parseTimestampMs,
  ALLOWED_DOMAINS,
} from "../src/lib/shared/event-validation.ts";

export { validateEventForPublish, parseTimestampMs };

/**
 * Initializes or retrieves the Firebase Admin instance defensively.
 * Automatically adapts between Cloud Functions (ambient credentials) and local dev (serviceAccountKey.json).
 */
export function getAdminApp() {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  // 1. Check for explicit service account path or standard local file
  let serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.resolve(process.cwd(), "serviceAccountKey.json");

  if (!fs.existsSync(serviceAccountPath)) {
    try {
      const adminSdkFiles = fs
        .readdirSync(process.cwd())
        .filter((f) => f.includes("firebase-adminsdk") && f.endsWith(".json"));
      if (adminSdkFiles.length > 0) {
        serviceAccountPath = path.resolve(process.cwd(), adminSdkFiles[0]);
      }
    } catch {
      // In restricted sandbox or deployed function where cwd readdir is not permitted
    }
  }

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || process.env.VITE_FIREBASE_PROJECT_ID,
    });
  }

  // Fallback to ambient default credentials (e.g. deployed Cloud Functions)
  return initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT,
  });
}

/**
 * Helper to get Admin Firestore instance.
 */
export function getAdminDb() {
  const app = getAdminApp();
  return getFirestore(app);
}

/**
 * Helper to get Admin Auth instance.
 */
export function getAdminAuth() {
  const app = getAdminApp();
  return getAuth(app);
}

/**
 * Authoritative state machine transition executor.
 *
 * @param {Object} params
 * @param {string} params.action - 'publish' | 'unpublish' | 'archive'
 * @param {string} params.eventId - The unique document ID of the event
 * @param {Object} params.actor - Verified actor information from Firebase Auth ID token
 * @param {string} params.actor.uid - Firebase UID
 * @param {string} params.actor.email - User email
 * @param {string} params.actor.role - Verified custom claims role ('super_admin')
 * @param {string} [params.actor.name] - User display name
 * @param {FirebaseFirestore.Firestore} [dbInstance] - Optional Firestore instance
 */
export async function executeLifecycleTransition(
  { action, eventId, actor },
  dbInstance = null
) {
  const db = dbInstance || getAdminDb();

  // 1. Authoritative Role Verification
  if (!actor || actor.role !== "super_admin") {
    const roleReported = actor?.role || "unauthenticated";
    throw new SecurityError(
      `Permission Denied: Event lifecycle actions require "super_admin" custom claim. Current actor role: "${roleReported}".`,
      403
    );
  }

  if (!eventId || typeof eventId !== "string" || eventId.trim() === "") {
    throw new ValidationError("Missing or invalid eventId parameter.", 400);
  }

  const validActions = ["publish", "unpublish", "archive"];
  if (!validActions.includes(action)) {
    throw new ValidationError(
      `Invalid lifecycle action "${action}". Allowed actions: ${validActions.join(", ")}.`,
      400
    );
  }

  const eventRef = db.collection("events").doc(eventId);
  const snap = await eventRef.get();

  if (!snap.exists) {
    throw new NotFoundError(`Event document "/events/${eventId}" does not exist in Firestore.`, 404);
  }

  const eventData = snap.data();
  const currentStatus = eventData.status || "draft";
  let newStatus = currentStatus;
  const updatePayload = {
    updatedAt: new Date().toISOString(),
  };

  // 2. State Machine Logic & Validation
  switch (action) {
    case "publish": {
      if (currentStatus === "published") {
        throw new StateTransitionError(`Event "${eventId}" is already published.`, 409);
      }

      // Enforce strict server-side validation
      const validation = validateEventForPublish(eventData);
      if (!validation.valid) {
        throw new ValidationError(
          `Publishing validation failed on server:\n- ${validation.errors.join("\n- ")}`,
          422,
          validation.errors
        );
      }

      newStatus = "published";
      updatePayload.status = "published";
      updatePayload.publishedAt = new Date().toISOString();
      if (eventData.isRegistrationOpen === undefined) {
        updatePayload.isRegistrationOpen = true;
      }
      break;
    }

    case "unpublish": {
      if (currentStatus !== "published") {
        throw new StateTransitionError(
          `Only published events can be unpublished. Current status: "${currentStatus}".`,
          409
        );
      }

      newStatus = "draft";
      updatePayload.status = "draft";
      break;
    }

    case "archive": {
      if (currentStatus === "archived") {
        throw new StateTransitionError(`Event "${eventId}" is already archived.`, 409);
      }

      newStatus = "archived";
      updatePayload.status = "archived";
      updatePayload.archivedAt = new Date().toISOString();
      updatePayload.isRegistrationOpen = false;
      break;
    }

    default:
      throw new ValidationError(`Unknown action "${action}".`, 400);
  }

  // 3. Atomically update event document
  await eventRef.update(updatePayload);

  // 4. Server-Side Audit Logging into /activity_logs
  try {
    const logRef = db.collection("activity_logs").doc();
    await logRef.set({
      id: logRef.id,
      actorEmail: actor.email || "super_admin@dscvitb.com",
      actorName: actor.name || "Super Admin",
      actorRole: "super_admin",
      actionType: `EVENT_${action.toUpperCase()}`,
      targetModule: "Settings",
      targetEntityId: eventId,
      details: `Super Admin (${actor.email}) transitioned event "${eventData.title}" (${eventId}) from "${currentStatus}" to "${newStatus}".`,
      timestamp: new Date().toISOString(),
    });
  } catch (logErr) {
    console.error("[DSC Event Lifecycle] Failed to write activity log:", logErr);
    // Non-fatal: do not abort the lifecycle transition if log write encounters transient error
  }

  return {
    success: true,
    eventId,
    title: eventData.title,
    previousStatus: currentStatus,
    newStatus,
    message: `Event "${eventData.title}" successfully transitioned to "${newStatus}".`,
  };
}

// Custom error classes for clean HTTP / CLI status mapping
export class SecurityError extends Error {
  constructor(message, statusCode = 403) {
    super(message);
    this.name = "SecurityError";
    this.statusCode = statusCode;
  }
}

export class ValidationError extends Error {
  constructor(message, statusCode = 400, details = []) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class StateTransitionError extends Error {
  constructor(message, statusCode = 409) {
    super(message);
    this.name = "StateTransitionError";
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends Error {
  constructor(message, statusCode = 404) {
    super(message);
    this.name = "NotFoundError";
    this.statusCode = statusCode;
  }
}
