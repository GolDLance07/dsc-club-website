/**
 * DSC VIT Bhopal — Firestore Client Foundation
 *
 * Implements:
 * - Safe Firestore initialization with local offline persistence.
 * - Typed collection references.
 * - Centralized data-access abstraction.
 */

import {
  getFirestore,
  collection,
  doc,
  type Firestore,
  type CollectionReference,
  type DocumentReference,
} from "firebase/firestore";
import { getFirebaseApp, isFirebaseConfigured } from "./config";
import type {
  ApplicationRecord,
  UserRoleRecord,
  ClubEvent,
  RegistrationRecord,
  ActivityLog,
  SystemSettings,
} from "@/types/models";

let firestoreInstance: Firestore | null = null;

/**
 * Returns the Firestore singleton instance or null if unconfigured.
 */
export function getFirebaseFirestore(): Firestore | null {
  if (firestoreInstance) return firestoreInstance;

  const app = getFirebaseApp();
  if (!app) return null;

  try {
    firestoreInstance = getFirestore(app);
    return firestoreInstance;
  } catch (error) {
    console.error("[DSC Firestore] Error initializing Firestore:", error);
    return null;
  }
}

/**
 * Collection Names
 */
export const FIRESTORE_COLLECTIONS = {
  HIRING_APPLICATIONS: "hiring_applications",
  USER_ROLES: "user_roles",
  EVENTS: "events",
  REGISTRATIONS: "registrations",
  ACTIVITY_LOGS: "activity_logs",
  SYSTEM_SETTINGS: "system_settings",
} as const;

/**
 * Typed Collection Reference Helpers
 */
export function getHiringCollection(): CollectionReference<ApplicationRecord> | null {
  const db = getFirebaseFirestore();
  if (!db) return null;
  return collection(db, FIRESTORE_COLLECTIONS.HIRING_APPLICATIONS) as CollectionReference<ApplicationRecord>;
}

export function getUserRolesCollection(): CollectionReference<UserRoleRecord> | null {
  const db = getFirebaseFirestore();
  if (!db) return null;
  return collection(db, FIRESTORE_COLLECTIONS.USER_ROLES) as CollectionReference<UserRoleRecord>;
}

export function getEventsCollection(): CollectionReference<ClubEvent> | null {
  const db = getFirebaseFirestore();
  if (!db) return null;
  return collection(db, FIRESTORE_COLLECTIONS.EVENTS) as CollectionReference<ClubEvent>;
}

export function getRegistrationsCollection(): CollectionReference<RegistrationRecord> | null {
  const db = getFirebaseFirestore();
  if (!db) return null;
  return collection(db, FIRESTORE_COLLECTIONS.REGISTRATIONS) as CollectionReference<RegistrationRecord>;
}

export function getActivityLogsCollection(): CollectionReference<ActivityLog> | null {
  const db = getFirebaseFirestore();
  if (!db) return null;
  return collection(db, FIRESTORE_COLLECTIONS.ACTIVITY_LOGS) as CollectionReference<ActivityLog>;
}
