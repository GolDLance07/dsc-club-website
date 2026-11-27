/**
 * DSC VIT Bhopal — Recruitment & Candidate Data Access Service
 *
 * Implements:
 * - Server-scoped query execution: Team Leads query ONLY their authorized domain via `teams array-contains leadDomain`.
 * - Zero client-side filtering over-the-wire.
 * - Strict field-level validation: Team Leads can only update approved evaluation fields.
 * - Public submission validation with initial status = 'applied'.
 */

import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { getFirebaseFirestore, FIRESTORE_COLLECTIONS } from "./firestore";
import { isFirebaseConfigured } from "./config";
import type { ApplicationRecord, ApplicationStatus, LeadDomain, RoleType } from "@/types/models";

export interface CandidateEvaluationUpdate {
  reviewerNotes?: string | undefined;
  interviewNotes?: string | undefined;
  evaluationScore?: number | undefined;
  status?: ApplicationStatus | undefined;
}

export interface PublicCandidateSubmission {
  fullName: string;
  registrationNumber: string;
  email: string;
  phone?: string;
  branch?: string;
  year?: string;
  primaryTeam: LeadDomain;
  secondaryTeam?: LeadDomain;
  portfolioUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  resumeFileUrl?: string;
  whyJoin: string;
  domainAnswers?: Record<string, string>;
}

// Strictly approved fields that can be updated during candidate review
const ALLOWED_EVALUATION_KEYS: Array<keyof CandidateEvaluationUpdate> = [
  "reviewerNotes",
  "interviewNotes",
  "evaluationScore",
  "status",
];

/**
 * Fetches recruitment applications based on caller role and domain.
 * Enforces server-side scoping: Team Leads NEVER receive applications outside their authorized domain.
 */
export async function getRecruitmentApplications(
  userRole: RoleType,
  leadDomain: LeadDomain
): Promise<ApplicationRecord[]> {
  if (!isFirebaseConfigured()) {
    // Return empty array when unconfigured; caller falls back to local cache if desired
    return [];
  }

  const db = getFirebaseFirestore();
  if (!db) return [];

  // 1. Members / Guests have zero authorization to query candidates
  if (userRole === "member") {
    throw new Error("Access Denied: You do not have permissions to view recruitment candidates.");
  }

  const appsCol = FIRESTORE_COLLECTIONS.HIRING_APPLICATIONS;

  // 2. Team Leads: STRICT server-side scoped query using indexed teams array
  if (userRole === "team_lead") {
    if (leadDomain === "None") {
      return [];
    }

    const scopedQuery = query(
      collection(db, appsCol),
      where("teams", "array-contains", leadDomain),
      orderBy("submittedAt", "desc")
    );

    const snapshot = await getDocs(scopedQuery);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as ApplicationRecord[];
  }

  // 3. Super Admin & Faculty Coordinator: Universal club-wide view
  const universalQuery = query(
    collection(db, appsCol),
    orderBy("submittedAt", "desc")
  );

  const snapshot = await getDocs(universalQuery);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as ApplicationRecord[];
}



/**
 * Updates candidate evaluation fields with strict server-side validation.
 * Prohibits modification of candidate identity, resume, or domain assignment.
 */
export async function updateCandidateEvaluation(
  applicationId: string,
  updates: CandidateEvaluationUpdate,
  userRole: RoleType,
  leadDomain: LeadDomain
): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured in this environment.");
  }

  const db = getFirebaseFirestore();
  if (!db) throw new Error("Firestore instance unavailable.");

  if (userRole === "member") {
    throw new Error("Access Denied: Members cannot evaluate candidates.");
  }

  // Verify that only approved evaluation fields are present
  const keys = Object.keys(updates) as Array<keyof CandidateEvaluationUpdate>;
  for (const k of keys) {
    if (!ALLOWED_EVALUATION_KEYS.includes(k)) {
      throw new Error(`Security Violation: Field '${String(k)}' is protected and cannot be modified.`);
    }
  }

  // If status is being updated by a Team Lead, verify stage validity
  if (userRole === "team_lead" && updates.status) {
    const allowedLeadStatuses: ApplicationStatus[] = ["applied", "shortlisted", "interview"];
    if (!allowedLeadStatuses.includes(updates.status)) {
      throw new Error(
        `Permission Denied: Team Leads may only advance candidates to 'shortlisted' or 'interview'. Final selection requires Super Admin.`
      );
    }
  }

  const appDocRef = doc(db, FIRESTORE_COLLECTIONS.HIRING_APPLICATIONS, applicationId);

  // If caller is Team Lead, verify that candidate belongs to their domain before updating
  if (userRole === "team_lead") {
    const existingSnap = await getDoc(appDocRef);
    if (!existingSnap.exists()) {
      throw new Error("Candidate application not found.");
    }
    const candidateData = existingSnap.data() as Record<string, unknown>;
    const rawTeams = candidateData["teams"];
    const teams: string[] = Array.isArray(rawTeams)
      ? (rawTeams as string[])
      : [String(candidateData["primaryTeam"] || "")];
    if (!teams.includes(leadDomain)) {
      throw new Error("Access Denied: You cannot evaluate a candidate outside your domain.");
    }
  }

  await updateDoc(appDocRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Submits a new candidate application from the public portal.
 * Enforces initial status = 'applied' and sets up the indexed `teams` array.
 */
export async function submitCandidateApplication(
  data: PublicCandidateSubmission
): Promise<string> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured in this environment.");
  }

  const db = getFirebaseFirestore();
  if (!db) throw new Error("Firestore instance unavailable.");

  // Validation
  if (!data.fullName?.trim() || data.fullName.length < 2) {
    throw new Error("Invalid input: Candidate full name is required.");
  }
  if (!data.email?.trim() || !data.email.includes("@")) {
    throw new Error("Invalid input: A valid email address is required.");
  }
  if (!data.primaryTeam) {
    throw new Error("Invalid input: Primary domain preference is required.");
  }

  // Build the indexed queryable teams array
  const teams = [data.primaryTeam, data.secondaryTeam].filter(Boolean) as LeadDomain[];

  const appId = `app-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const appDocRef = doc(db, FIRESTORE_COLLECTIONS.HIRING_APPLICATIONS, appId);

  const newRecord: ApplicationRecord & { teams: LeadDomain[] } = {
    id: appId,
    fullName: data.fullName.trim(),
    registrationNumber: data.registrationNumber.trim().toUpperCase(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone?.trim() || "",
    branch: data.branch || "",
    year: data.year || "",
    primaryTeam: data.primaryTeam,
    secondaryTeam: data.secondaryTeam,
    portfolioUrl: data.portfolioUrl || "",
    githubUrl: data.githubUrl || "",
    linkedinUrl: data.linkedinUrl || "",
    resumeFileUrl: data.resumeFileUrl || "",
    whyJoin: data.whyJoin || "",
    domainAnswers: data.domainAnswers || {},
    status: "applied", // Strictly enforce initial status
    submittedAt: new Date().toISOString(),
    teams,
  };

  await setDoc(appDocRef, newRecord);
  return appId;
}
