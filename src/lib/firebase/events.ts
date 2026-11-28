/**
 * DSC VIT Bhopal — Centralized Event Management Data Access Service
 *
 * Implements:
 * - Domain-scoped event queries for Team Leads (`domainScope == leadDomain`).
 * - Universal administrative access for Super Admin and Faculty Coordinator.
 * - Strict publishing validation (content metadata and chronological date checks).
 * - Lifecycle state transitions ('draft', 'published', 'archived') restricted to Super Admin.
 * - Public querying for published events.
 * - Unconfigured fallback to preserve local development without crashing.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { getFirebaseFirestore, FIRESTORE_COLLECTIONS } from "./firestore";
import { isFirebaseConfigured } from "./config";
import { getFirebaseAuth } from "./auth";
import { validateEventForPublish } from "@/lib/shared/event-validation";
import type {
  CentralizedClubEvent,
  EventStatus,
  RoleType,
  LeadDomain,
  ActivityLog,
} from "@/types/models";

/**
 * Checks whether the Cloudflare Worker API is configured.
 * - In development: returns true because the Vite development middleware handles /api endpoints.
 * - In production: returns true only if VITE_WORKER_API_URL is explicitly set.
 */
export function isWorkerConfigured(): boolean {
  if (import.meta.env.DEV) {
    return true;
  }
  const envUrl = (import.meta.env["VITE_WORKER_API_URL"] as string)?.trim();
  return Boolean(envUrl && envUrl.length > 0);
}

/**
 * Resolves the Cloudflare Worker API base URL.
 * Throws a clear configuration error in production if VITE_WORKER_API_URL is missing.
 */
export function getWorkerApiBase(): string {
  const envUrl = (import.meta.env["VITE_WORKER_API_URL"] as string)?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  if (import.meta.env.DEV) {
    return "";
  }

  throw new Error(
    "Configuration Error: Missing VITE_WORKER_API_URL environment variable. The public Cloudflare Worker API endpoint must be configured in production."
  );
}

// Fallback seed events for offline / unconfigured mode
const FALLBACK_EVENTS: CentralizedClubEvent[] = [
  {
    id: "pytorch-bootcamp-2026",
    slug: "pytorch-bootcamp-2026",
    title: "PyTorch Deep Learning Sprint",
    tagline: "Hands-on Deep Learning Bootcamp",
    category: "BOOTCAMP",
    status: "published",
    domainScope: "AI & Data Science",
    startDate: "2026-10-24T10:00:00.000Z",
    endDate: "2026-10-24T16:00:00.000Z",
    timeDisplay: "10:00 AM - 4:00 PM IST",
    venue: "Lab Complex 3 // AB-1 High-Perf Lab",
    mode: "In-Person",
    speaker: "AI/ML Core Lead",
    description:
      "A hands-on, hardware-accelerated deep dive into neural tensor architectures, gradient descent graph compilation, and fine-tuning computer vision backbones.",
    longBio:
      "This 6-hour intensive bootcamp guides developers through tensor manipulation, building custom autoencoders, and deploying models to mobile & edge backends using TensorRT and ONNX runtime.",
    maxCapacity: 200,
    currentRegistrations: 142,
    registrationDeadline: "2026-10-23T23:59:59.000Z",
    isRegistrationOpen: true,
    createdBy: {
      uid: "system-bootstrap",
      email: "aimllead@dscvitb.com",
      name: "AI/ML Lead",
    },
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    publishedAt: "2026-10-02T00:00:00.000Z",
  },
  {
    id: "datahacks-26",
    slug: "datahacks-26",
    title: "DataHacks '26 (36-Hour Hackathon)",
    tagline: "Central India Flagship Collegiate Hackathon",
    category: "HACKATHON",
    status: "published",
    domainScope: "Technical",
    startDate: "2026-11-14T09:00:00.000Z",
    endDate: "2026-11-16T21:00:00.000Z",
    timeDisplay: "9:00 AM Fri - 9:00 PM Sun",
    venue: "Innovation Center & Central Auditorium",
    mode: "In-Person",
    speaker: "DSC Executive Board",
    description:
      "36 hours of relentless engineering, machine learning pipelines, distributed system architectures, and edge deployment challenges with ₹1,00,000 in cash prizes.",
    longBio:
      "Join 400+ top collegiate developers across India. Tracks include Autonomous Agents, Distributed Data Infrastructure, Privacy-Preserving ML, and Decentralized Systems.",
    maxCapacity: 400,
    currentRegistrations: 388,
    registrationDeadline: "2026-11-10T23:59:59.000Z",
    isRegistrationOpen: true,
    createdBy: {
      uid: "system-bootstrap",
      email: "president@dscvitb.com",
      name: "Neel Pandey",
    },
    createdAt: "2026-10-10T00:00:00.000Z",
    updatedAt: "2026-10-10T00:00:00.000Z",
    publishedAt: "2026-10-12T00:00:00.000Z",
  },
];

let localEventsStore: CentralizedClubEvent[] = [...FALLBACK_EVENTS];

/**
 * Retrieves all events for the admin panel based on role and domain.
 * - Team Leads: Query restricted to their domainScope.
 * - Super Admin & Faculty: Universal query for all events.
 */
export async function getEventsForAdmin(
  userRole: RoleType,
  leadDomain: LeadDomain
): Promise<CentralizedClubEvent[]> {
  if (userRole === "member") {
    throw new Error("Access Denied: Members cannot access the event management system.");
  }

  if (!isFirebaseConfigured()) {
    if (userRole === "team_lead" && leadDomain !== "None") {
      return localEventsStore.filter(
        (e) => e.domainScope === leadDomain || e.domainScope === "None"
      );
    }
    return localEventsStore;
  }

  const db = getFirebaseFirestore();
  if (!db) return [];

  const eventsCol = collection(db, FIRESTORE_COLLECTIONS.EVENTS);

  // 1. Team Leads: Server-scoped query by domainScope
  if (userRole === "team_lead") {
    const leadQuery = query(
      eventsCol,
      where("domainScope", "==", leadDomain),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(leadQuery);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as CentralizedClubEvent[];
  }

  // 2. Super Admin & Faculty: All events
  const adminQuery = query(eventsCol, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(adminQuery);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as CentralizedClubEvent[];
}

/**
 * Retrieves published events for public site consumption.
 * Draft events are never returned and blocked by Firestore security rules.
 */
export async function getPublishedEvents(): Promise<CentralizedClubEvent[]> {
  if (!isFirebaseConfigured()) {
    if (import.meta.env.PROD) {
      throw new Error(
        "Configuration Error: Firebase client configuration is missing in production."
      );
    }
    return localEventsStore.filter((e) => e.status === "published");
  }

  const db = getFirebaseFirestore();
  if (!db) {
    throw new Error("Firestore service is unavailable.");
  }

  const q = query(
    collection(db, FIRESTORE_COLLECTIONS.EVENTS),
    where("status", "==", "published"),
    orderBy("startDate", "asc")
  );

  const snapshot = await getDocs(q);
  const events = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as CentralizedClubEvent[];
  return events.filter((e) => e.status === "published");
}

/**
 * Retrieves archived events for the public past-events/archive directory.
 * Uses a single-field status equality query matching Firestore public read rules
 * and sorts descending by startDate in memory.
 */
export async function getArchivedEvents(): Promise<CentralizedClubEvent[]> {
  if (!isFirebaseConfigured()) {
    if (import.meta.env.PROD) {
      throw new Error(
        "Configuration Error: Firebase client configuration is missing in production."
      );
    }
    return localEventsStore.filter((e) => e.status === "archived");
  }

  const db = getFirebaseFirestore();
  if (!db) {
    throw new Error("Firestore service is unavailable.");
  }

  const q = query(
    collection(db, FIRESTORE_COLLECTIONS.EVENTS),
    where("status", "==", "archived")
  );

  const snapshot = await getDocs(q);
  const events = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as CentralizedClubEvent[];
  return events
    .filter((e) => e.status === "archived")
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}

/**
 * Retrieves recent system audit logs from Firestore `/activity_logs`.
 * Restricted to Super Admin & Faculty Coordinator via Firestore security rules.
 */
export async function getActivityLogsFromFirestore(maxLogs = 100): Promise<ActivityLog[]> {
  if (!isFirebaseConfigured()) {
    return [];
  }

  const db = getFirebaseFirestore();
  if (!db) return [];

  const q = query(
    collection(db, FIRESTORE_COLLECTIONS.ACTIVITY_LOGS),
    orderBy("timestamp", "desc"),
    limit(maxLogs)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ActivityLog[];
}

/**
 * Creates a new event draft.
 * - Team Leads can only create 'draft' events within their authorized domain.
 * - Enforces immutable createdBy attribution and initial counters.
 */
export async function createEventDraft(
  data: Omit<
    CentralizedClubEvent,
    "id" | "status" | "currentRegistrations" | "createdAt" | "updatedAt" | "createdBy"
  >,
  user: { uid: string; email: string; name: string },
  userRole: RoleType,
  leadDomain: LeadDomain
): Promise<CentralizedClubEvent> {
  if (userRole === "member") {
    throw new Error("Access Denied: Members cannot create events.");
  }

  // Team Lead domain boundary enforcement
  if (userRole === "team_lead") {
    if (data.domainScope !== leadDomain) {
      throw new Error(`Permission Denied: You may only create events for the "${leadDomain}" domain.`);
    }
  }

  const eventId = data.slug
    ? data.slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-")
    : `event-${Date.now()}`;

  const now = new Date().toISOString();

  const newEvent: CentralizedClubEvent = {
    ...data,
    id: eventId,
    slug: eventId,
    status: "draft", // Always initialize as draft
    domainScope: userRole === "team_lead" ? leadDomain : data.domainScope,
    currentRegistrations: 0,
    createdBy: {
      uid: user.uid,
      email: user.email,
      name: user.name || user.email,
    },
    createdAt: now,
    updatedAt: now,
  };

  if (!isFirebaseConfigured()) {
    if (import.meta.env.PROD) {
      throw new Error(
        "Configuration Error: Firebase is unconfigured in production. Offline simulation is disabled."
      );
    }
    localEventsStore.unshift(newEvent);
    return newEvent;
  }

  const db = getFirebaseFirestore();
  if (!db) throw new Error("Firestore instance unavailable.");

  await setDoc(doc(db, FIRESTORE_COLLECTIONS.EVENTS, eventId), newEvent);
  return newEvent;
}

/**
 * Protected system fields that Team Leads are strictly forbidden from modifying.
 */
const PROTECTED_SYSTEM_FIELDS = [
  "status",
  "createdBy",
  "createdAt",
  "currentRegistrations",
  "publishedAt",
  "archivedAt",
  "domainScope",
];

/**
 * Updates an event draft's content fields.
 * - Team Leads can only update drafts belonging to their domain.
 * - Protects system-managed fields.
 */
export async function updateEventDraft(
  eventId: string,
  updates: Partial<CentralizedClubEvent>,
  userRole: RoleType,
  leadDomain: LeadDomain
): Promise<void> {
  if (userRole === "member") {
    throw new Error("Access Denied: Members cannot edit events.");
  }

  // 1. Team Lead Protected Field Check
  if (userRole === "team_lead") {
    const keys = Object.keys(updates);
    for (const key of keys) {
      if (PROTECTED_SYSTEM_FIELDS.includes(key)) {
        throw new Error(
          `Security Violation: Field "${key}" is protected and cannot be modified by a Team Lead.`
        );
      }
    }
  }

  const now = new Date().toISOString();
  const safeUpdates = {
    ...updates,
    updatedAt: now,
  };

  if (!isFirebaseConfigured()) {
    if (import.meta.env.PROD) {
      throw new Error(
        "Configuration Error: Firebase is unconfigured in production. Offline simulation is disabled."
      );
    }
    const idx = localEventsStore.findIndex((e) => e.id === eventId);
    if (idx >= 0 && localEventsStore[idx]) {
      const existing = localEventsStore[idx]!;
      if (userRole === "team_lead" && existing.domainScope !== leadDomain) {
        throw new Error("Access Denied: You cannot modify an event from another domain.");
      }
      localEventsStore[idx] = { ...existing, ...safeUpdates } as CentralizedClubEvent;
    }
    return;
  }

  const db = getFirebaseFirestore();
  if (!db) throw new Error("Firestore instance unavailable.");

  const eventRef = doc(db, FIRESTORE_COLLECTIONS.EVENTS, eventId);

  if (userRole === "team_lead") {
    const snap = await getDoc(eventRef);
    if (!snap.exists()) throw new Error("Event not found.");
    const current = snap.data() as CentralizedClubEvent;
    if (current.domainScope !== leadDomain) {
      throw new Error("Access Denied: You cannot modify an event from another domain.");
    }
    if (current.status !== "draft") {
      throw new Error("Access Denied: Team Leads may only edit events in 'draft' status.");
    }
  }

  await updateDoc(eventRef, safeUpdates);
}

/**
 * Validates whether an event meets all rigorous criteria to be published.
 * Re-exports the authoritative pure validation from shared event-validation module.
 */
export const validatePublishEvent = validateEventForPublish;

/**
 * Executes a trusted server-side lifecycle transition via backend API or Cloud Function.
 * The client browser NEVER modifies event lifecycle status directly in Firestore.
 */
async function callTrustedEventLifecycle(
  action: "publish" | "unpublish" | "archive",
  eventId: string
): Promise<{ success: boolean; message: string; newStatus?: EventStatus }> {
  if (!isFirebaseConfigured()) {
    if (import.meta.env.PROD) {
      throw new Error(
        "Configuration Error: Firebase is unconfigured in production. Offline simulation is disabled."
      );
    }
    // Offline / unconfigured fallback
    const idx = localEventsStore.findIndex((e) => e.id === eventId);
    if (idx >= 0 && localEventsStore[idx]) {
      const target = localEventsStore[idx]!;
      if (action === "publish") {
        const validation = validatePublishEvent(target);
        if (!validation.valid) {
          throw new Error(`Publishing Validation Failed:\n- ${validation.errors.join("\n- ")}`);
        }
        localEventsStore[idx] = {
          ...target,
          status: "published",
          publishedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      } else if (action === "unpublish") {
        localEventsStore[idx] = {
          ...target,
          status: "draft",
          updatedAt: new Date().toISOString(),
        };
      } else if (action === "archive") {
        localEventsStore[idx] = {
          ...target,
          status: "archived",
          archivedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      return {
        success: true,
        message: `Offline mode: Event successfully transitioned to ${localEventsStore[idx]?.status}.`,
        newStatus: localEventsStore[idx]?.status,
      };
    }
    throw new Error(`Offline event "${eventId}" not found.`);
  }

  // 1. Authoritative Auth Verification
  const auth = getFirebaseAuth();
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error("Authentication Required: You must be logged in as Super Admin to perform lifecycle operations.");
  }

  // Force token refresh to send valid, up-to-date custom claims
  const idToken = await currentUser.getIdToken(true);

  // 2. Resolve endpoint: configured Cloudflare Worker API URL or relative dev path
  const apiBase = getWorkerApiBase();
  const endpointUrl = `${apiBase}/api/events/lifecycle`;

  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ action, eventId }),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      details?: string[];
    };
    const errorMessage =
      errorBody.error ||
      errorBody.message ||
      `Server rejected lifecycle action with status ${response.status}.`;
    throw new Error(errorMessage);
  }

  return (await response.json()) as {
    success: boolean;
    message: string;
    newStatus?: EventStatus;
  };
}

/**
 * Transitions an event from 'draft' to 'published' via the trusted server endpoint.
 * Strictly restricted to Super Admin.
 */
export async function publishEvent(
  eventId: string,
  userRole: RoleType
): Promise<{ success: boolean; message: string }> {
  if (userRole !== "super_admin") {
    throw new Error("Permission Denied: Only Super Admin (President) can publish events.");
  }
  return await callTrustedEventLifecycle("publish", eventId);
}

/**
 * Unpublishes a published event back to 'draft' via the trusted server endpoint.
 * Strictly restricted to Super Admin.
 */
export async function unpublishEvent(
  eventId: string,
  userRole: RoleType
): Promise<{ success: boolean; message: string }> {
  if (userRole !== "super_admin") {
    throw new Error("Permission Denied: Only Super Admin (President) can unpublish events.");
  }
  return await callTrustedEventLifecycle("unpublish", eventId);
}

/**
 * Transitions an event to 'archived' via the trusted server endpoint.
 * Strictly restricted to Super Admin.
 */
export async function archiveEvent(
  eventId: string,
  userRole: RoleType
): Promise<{ success: boolean; message: string }> {
  if (userRole !== "super_admin") {
    throw new Error("Permission Denied: Only Super Admin (President) can archive events.");
  }
  return await callTrustedEventLifecycle("archive", eventId);
}

/**
 * Deletes an event via the trusted Worker backend API.
 * The client browser NEVER deletes event documents directly from Firestore.
 * Strictly restricted to Super Admin.
 */
export async function deleteEvent(
  eventId: string,
  userRole: RoleType
): Promise<void> {
  if (userRole !== "super_admin") {
    throw new Error("Permission Denied: Only Super Admin can delete events.");
  }

  if (!isFirebaseConfigured()) {
    if (import.meta.env.PROD) {
      throw new Error(
        "Configuration Error: Firebase is unconfigured in production. Offline simulation is disabled."
      );
    }
    localEventsStore = localEventsStore.filter((e) => e.id !== eventId);
    return;
  }

  const auth = getFirebaseAuth();
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error("Authentication Required: You must be logged in as Super Admin to delete events.");
  }

  const idToken = await currentUser.getIdToken(true);
  const apiBase = getWorkerApiBase();
  const endpointUrl = `${apiBase}/api/events/${eventId}`;

  const response = await fetch(endpointUrl, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    const errorMessage =
      errorBody.error ||
      errorBody.message ||
      `Server rejected event deletion with status ${response.status}.`;
    throw new Error(errorMessage);
  }
}
