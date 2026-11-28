/**
 * DSC VIT Bhopal — Cloudflare Worker RBAC Role Assignment Service
 *
 * Authoritatively assigns Firebase Authentication custom claims via the
 * Google Identity Toolkit REST API (`accounts:lookup` & `accounts:update`)
 * and synchronizes canonical `/user_roles/{uid}` records in Firestore.
 *
 * Security invariants:
 * - Strictly restricted to existing `super_admin` callers.
 * - Enforces the 4-role RBAC hierarchy (`super_admin`, `faculty_coordinator`, `team_lead`, `member`).
 * - Rejects self-assignment / self-promotion by email or UID.
 * - Rejects arbitrary client claims; constructs only `{ role, leadDomain, title }`.
 * - Enforces valid club domains for `team_lead` and `"None"` for other roles.
 */

import type { VerifiedUser } from "./auth.ts";
import { recordActivityLog, upsertUserRoleDocument } from "./firestore.ts";
import { ALLOWED_DOMAINS } from "../src/lib/shared/event-validation.ts";

export const VALID_RBAC_ROLES = [
  "super_admin",
  "faculty_coordinator",
  "team_lead",
  "member",
] as const;

export type RbacRole = (typeof VALID_RBAC_ROLES)[number];

export interface AssignRoleResult {
  success: boolean;
  uid: string;
  email: string;
  fullName: string;
  role: RbacRole;
  leadDomain: string;
  title: string;
  message: string;
}

interface IdentityLookupResponse {
  users?: Array<{
    localId?: string;
    email?: string;
    displayName?: string;
  }>;
}

function defaultTitleForRole(role: RbacRole, leadDomain: string): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "faculty_coordinator":
      return "Faculty Coordinator";
    case "team_lead":
      return `${leadDomain} Team Lead`;
    default:
      return "Club Member";
  }
}

export async function executeWorkerRoleAssignment(params: {
  projectId: string;
  identityAccessToken: string;
  firestoreAccessToken: string;
  actor: VerifiedUser;
  targetEmail: string;
  fullName?: string;
  role: string;
  leadDomain?: string;
  title?: string;
  fetchFn?: typeof fetch;
}): Promise<AssignRoleResult> {
  const {
    projectId,
    identityAccessToken,
    firestoreAccessToken,
    actor,
    targetEmail,
    fullName,
    role,
    leadDomain,
    title,
    fetchFn = fetch,
  } = params;

  // 1. Authoritative Role Verification (Super Admin Only)
  if (!actor || actor.role !== "super_admin") {
    throw new RbacError(
      `Permission Denied: Role assignment requires "super_admin" privileges. Current role: "${actor?.role || "unknown"}".`,
      403
    );
  }

  // 2. Validate Target Email
  const normalizedEmail = typeof targetEmail === "string" ? targetEmail.trim().toLowerCase() : "";
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new RbacError("Invalid or missing target user email address.", 400);
  }

  // 3. Prevent Self-Assignment / Self-Promotion by Email
  const actorEmail = (actor.email || "").trim().toLowerCase();
  if (actorEmail && normalizedEmail === actorEmail) {
    throw new RbacError(
      "Permission Denied: Administrators cannot modify or promote their own role.",
      403
    );
  }

  // 4. Validate Role Strictly Against the 4-Role Model
  if (!VALID_RBAC_ROLES.includes(role as RbacRole)) {
    throw new RbacError(
      `Invalid role "${String(role)}". Allowed roles: ${VALID_RBAC_ROLES.join(", ")}.`,
      400
    );
  }
  const validatedRole = role as RbacRole;

  // 5. Enforce Domain Scope Rules
  let validatedDomain = "None";
  if (validatedRole === "team_lead") {
    const requestedDomain = typeof leadDomain === "string" ? leadDomain.trim() : "";
    if (!ALLOWED_DOMAINS.includes(requestedDomain as (typeof ALLOWED_DOMAINS)[number])) {
      throw new RbacError(
        `Invalid leadDomain "${requestedDomain}" for team_lead. Allowed domains: ${ALLOWED_DOMAINS.join(", ")}.`,
        400
      );
    }
    validatedDomain = requestedDomain;
  }

  // 6. Sanitize Designation Title
  const rawTitle = typeof title === "string" ? title.trim().slice(0, 80) : "";
  const validatedTitle = rawTitle || defaultTitleForRole(validatedRole, validatedDomain);

  // 7. Resolve Target User via Firebase Auth Identity Toolkit REST API
  const lookupUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`;
  const lookupRes = await fetchFn(lookupUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${identityAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: [normalizedEmail] }),
  });

  if (!lookupRes.ok) {
    throw new RbacError(
      `Firebase Authentication lookup failed (HTTP ${lookupRes.status}).`,
      502
    );
  }

  const lookupData = (await lookupRes.json()) as IdentityLookupResponse;
  const targetUser = lookupData.users?.[0];
  if (!targetUser?.localId) {
    throw new RbacError(
      `No Firebase Authentication account found for "${normalizedEmail}". Have the user sign in with Google once first so their account exists, then retry.`,
      404
    );
  }

  const targetUid = targetUser.localId;

  // 8. Prevent Self-Assignment by UID
  if (targetUid === actor.uid) {
    throw new RbacError(
      "Permission Denied: Administrators cannot modify or promote their own role.",
      403
    );
  }

  // 9. Update Custom Claims via Identity Toolkit `accounts:update`
  const claimsPayload = {
    role: validatedRole,
    leadDomain: validatedDomain,
    title: validatedTitle,
  };

  const updateUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`;
  const updateRes = await fetchFn(updateUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${identityAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      localId: targetUid,
      customAttributes: JSON.stringify(claimsPayload),
    }),
  });

  if (!updateRes.ok) {
    throw new RbacError(
      `Failed to update Firebase Authentication custom claims (HTTP ${updateRes.status}).`,
      502
    );
  }

  const resolvedName =
    (typeof fullName === "string" && fullName.trim()) ||
    targetUser.displayName ||
    normalizedEmail.split("@")[0] ||
    "Panel User";

  // 10. Sync Canonical Role Record in Firestore `/user_roles/{uid}` & Audit Log
  const nowIso = new Date().toISOString();
  await upsertUserRoleDocument(projectId, firestoreAccessToken, targetUid, {
    id: targetUid,
    userId: targetUid,
    email: normalizedEmail,
    fullName: resolvedName,
    role: validatedRole,
    title: validatedTitle,
    leadDomain: validatedDomain,
    isActive: validatedRole !== "member",
    assignedBy: actor.email || actor.uid,
    updatedAt: nowIso,
    createdAt: nowIso,
  });

  await recordActivityLog(projectId, firestoreAccessToken, {
    actorEmail: actor.email || "super_admin@dscvitb.com",
    actorName: actor.name || "Super Admin",
    actorRole: "super_admin",
    actionType: validatedRole === "member" ? "REVOKE_ROLE" : "ASSIGN_ROLE",
    targetModule: "UserRole",
    targetEntityId: targetUid,
    details: `Super Admin (${actor.email}) set role "${validatedRole}" (${validatedTitle}, domain: ${validatedDomain}) for ${normalizedEmail}.`,
  });

  return {
    success: true,
    uid: targetUid,
    email: normalizedEmail,
    fullName: resolvedName,
    role: validatedRole,
    leadDomain: validatedDomain,
    title: validatedTitle,
    message:
      validatedRole === "member"
        ? `Revoked management panel privileges for ${normalizedEmail}.`
        : `Granted ${validatedRole} (${validatedTitle}) privileges to ${normalizedEmail}. Ask them to sign out and sign back in to refresh their session.`,
  };
}

export class RbacError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "RbacError";
    this.statusCode = statusCode;
  }
}
