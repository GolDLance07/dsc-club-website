/**
 * DSC VIT Bhopal — Authoritative RBAC Role Assignment Client
 *
 * Routes role provisioning and revocation through the trusted Cloudflare Worker
 * (`POST /api/admin/assign-role`) which updates Firebase Authentication custom claims
 * and syncs Firestore `/user_roles/{uid}`.
 */

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { getFirebaseAuth } from "./auth";
import { isFirebaseConfigured } from "./config";
import { getFirebaseFirestore, FIRESTORE_COLLECTIONS } from "./firestore";
import { getWorkerApiBase } from "./events";
import { dataEngine } from "@/lib/data-engine";
import type { LeadDomain, RoleType, UserRoleRecord } from "@/types/models";

export interface AssignPanelRoleInput {
  email: string;
  fullName?: string;
  role: RoleType;
  leadDomain?: LeadDomain;
  title?: string;
}

export interface AssignPanelRoleResponse {
  success: boolean;
  uid: string;
  email: string;
  fullName: string;
  role: RoleType;
  leadDomain: LeadDomain | string;
  title: string;
  message: string;
}

/**
 * Fetches panel role records from Firestore `/user_roles` when configured.
 * Falls back to local cache only in unconfigured DEV mode.
 */
export async function getPanelUserRoles(): Promise<UserRoleRecord[]> {
  if (!isFirebaseConfigured()) {
    if (import.meta.env.PROD) {
      throw new Error(
        "Configuration Error: Firebase is unconfigured in production."
      );
    }
    return dataEngine.getUserRoles();
  }

  const db = getFirebaseFirestore();
  if (!db) return [];

  const q = query(
    collection(db, FIRESTORE_COLLECTIONS.USER_ROLES),
    orderBy("updatedAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as UserRoleRecord)
    .filter((r) => r.isActive !== false && r.role !== "member");
}

/**
 * Authoritatively assigns or revokes a Firebase Auth role via the trusted Cloudflare Worker.
 * Never writes authorization state to localStorage when Firebase is configured.
 */
export async function assignPanelRole(
  input: AssignPanelRoleInput
): Promise<AssignPanelRoleResponse> {
  if (!isFirebaseConfigured()) {
    if (import.meta.env.PROD) {
      throw new Error(
        "Configuration Error: Firebase is unconfigured in production. Role assignment is disabled."
      );
    }
    const created = await dataEngine.assignUserRole({
      email: input.email.trim().toLowerCase(),
      fullName: input.fullName?.trim() || input.email,
      role: input.role,
      title: input.title?.trim() || input.role,
      leadDomain: input.role === "team_lead" ? input.leadDomain || "Technical" : "None",
      isActive: input.role !== "member",
    });
    return {
      success: true,
      uid: created.id,
      email: created.email,
      fullName: created.fullName,
      role: created.role,
      leadDomain: created.leadDomain || "None",
      title: created.title,
      message: `Offline dev mode: Updated local role for ${created.email}.`,
    };
  }

  const auth = getFirebaseAuth();
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error(
      "Authentication Required: You must be signed in as Super Admin to assign roles."
    );
  }

  const idToken = await currentUser.getIdToken(true);
  const apiBase = getWorkerApiBase();
  const endpointUrl = `${apiBase}/api/admin/assign-role`;

  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      fullName: input.fullName?.trim(),
      role: input.role,
      leadDomain: input.role === "team_lead" ? input.leadDomain : "None",
      title: input.title?.trim(),
    }),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(
      errorBody.error ||
        errorBody.message ||
        `Role assignment rejected by server (HTTP ${response.status}).`
    );
  }

  return (await response.json()) as AssignPanelRoleResponse;
}
