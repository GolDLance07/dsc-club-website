/**
 * DSC VIT Bhopal — Firebase Authentication & RBAC Service
 *
 * Implements:
 * - Google Sign-In with browser local persistence.
 * - Authoritative Custom Claims extraction (role & leadDomain).
 * - Cryptographic verification via getIdTokenResult(forceRefresh).
 * - Safe fallback handling when Firebase is unconfigured.
 */

import {
  getAuth,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
  type Auth,
  type User,
  type IdTokenResult,
} from "firebase/auth";
import { getFirebaseApp, isFirebaseConfigured } from "./config";
import type { RoleType, LeadDomain } from "@/types/models";

const VALID_ROLES: RoleType[] = [
  "super_admin",
  "faculty_coordinator",
  "team_lead",
  "member",
];

const VALID_DOMAINS: LeadDomain[] = [
  "Technical",
  "AI & Data Science",
  "Design & Media",
  "Content & Editorial",
  "Management & PR",
  "None",
];

export interface DecodedUserClaims {
  role: RoleType;
  leadDomain: LeadDomain;
  title: string;
}

let authInstance: Auth | null = null;

/**
 * Returns the Auth singleton or null if Firebase is not configured.
 */
export function getFirebaseAuth(): Auth | null {
  if (authInstance) return authInstance;

  const app = getFirebaseApp();
  if (!app) return null;

  try {
    authInstance = getAuth(app);
    // Enforce local persistence so login survives page refreshes
    setPersistence(authInstance, browserLocalPersistence).catch((err) => {
      console.warn("[DSC Auth] Could not set persistence:", err);
    });
    return authInstance;
  } catch (error) {
    console.error("[DSC Auth] Error getting Auth instance:", error);
    return null;
  }
}

/**
 * Parses and validates custom claims from an ID token result.
 * Never trusts unvalidated client input.
 */
export function extractClaimsFromToken(tokenResult: IdTokenResult | null): DecodedUserClaims {
  if (!tokenResult || !tokenResult.claims) {
    return {
      role: "member",
      leadDomain: "None",
      title: "Club Member",
    };
  }

  const rawRole = tokenResult.claims["role"] as string | undefined;
  const rawDomain = tokenResult.claims["leadDomain"] as string | undefined;
  const rawTitle = tokenResult.claims["title"] as string | undefined;

  const role: RoleType =
    rawRole && VALID_ROLES.includes(rawRole as RoleType)
      ? (rawRole as RoleType)
      : "member";

  const leadDomain: LeadDomain =
    rawDomain && VALID_DOMAINS.includes(rawDomain as LeadDomain)
      ? (rawDomain as LeadDomain)
      : "None";

  let defaultTitle = "Club Member";
  if (role === "super_admin") defaultTitle = "President";
  else if (role === "faculty_coordinator") defaultTitle = "Faculty Coordinator";
  else if (role === "team_lead") defaultTitle = `${leadDomain} Lead`;

  return {
    role,
    leadDomain,
    title: rawTitle && typeof rawTitle === "string" ? rawTitle : defaultTitle,
  };
}

/**
 * Signs in using Google OAuth Popup.
 * Restricts access or extracts claims post-login.
 */
export async function signInWithGoogle(): Promise<{ user: User; claims: DecodedUserClaims }> {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured in this environment. Please provide VITE_FIREBASE_* environment variables."
    );
  }

  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error("Firebase Authentication could not be initialized.");
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: "select_account",
  });

  const credential = await signInWithPopup(auth, provider);
  const user = credential.user;

  // Retrieve cryptographically signed custom claims from the token
  const tokenResult = await user.getIdTokenResult(true);
  const claims = extractClaimsFromToken(tokenResult);

  return { user, claims };
}

/**
 * Signs out the current authenticated user.
 */
export async function signOutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await firebaseSignOut(auth);
}

/**
 * Refreshes the user's ID token to fetch latest custom claims from backend.
 */
export async function refreshCurrentUserClaims(user: User): Promise<DecodedUserClaims> {
  const tokenResult = await user.getIdTokenResult(true);
  return extractClaimsFromToken(tokenResult);
}

/**
 * Subscribes to auth state changes and resolves with both user and decoded claims.
 */
export function onAuthClaimsStateChanged(
  callback: (user: User | null, claims: DecodedUserClaims) => void
): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    // Immediate callback for unconfigured state
    callback(null, {
      role: "member",
      leadDomain: "None",
      title: "Guest",
    });
    return () => {};
  }

  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null, {
        role: "member",
        leadDomain: "None",
        title: "Guest",
      });
      return;
    }

    try {
      const tokenResult = await user.getIdTokenResult();
      const claims = extractClaimsFromToken(tokenResult);
      callback(user, claims);
    } catch (err) {
      console.error("[DSC Auth] Error fetching user ID token result:", err);
      callback(user, {
        role: "member",
        leadDomain: "None",
        title: "Member",
      });
    }
  });
}
