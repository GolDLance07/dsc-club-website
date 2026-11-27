/**
 * DSC VIT Bhopal — Authentication Context & Provider
 *
 * Provides reactive authentication state across the application:
 * - Current Firebase User
 * - Authoritative Custom Claims (role, leadDomain, title)
 * - Sign-in with Google
 * - Sign-out
 * - Graceful unconfigured fallback
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import type { User } from "firebase/auth";
import type { RoleType, LeadDomain } from "@/types/models";
import {
  signInWithGoogle as authSignInWithGoogle,
  signOutUser,
  refreshCurrentUserClaims,
  onAuthClaimsStateChanged,
  type DecodedUserClaims,
} from "@/lib/firebase/auth";
import { isFirebaseConfigured } from "@/lib/firebase/config";

export interface AuthContextValue {
  user: User | null;
  role: RoleType;
  leadDomain: LeadDomain;
  title: string;
  isConfigured: boolean;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<DecodedUserClaims>({
    role: "member",
    leadDomain: "None",
    title: "Guest",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = useMemo(() => isFirebaseConfigured(), []);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthClaimsStateChanged((currentUser, decodedClaims) => {
      setUser(currentUser);
      setClaims(decodedClaims);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isConfigured]);

  const handleSignInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      const { user: signedInUser, claims: newClaims } = await authSignInWithGoogle();
      setUser(signedInUser);
      setClaims(newClaims);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign in with Google.";
      setError(msg);
      throw err;
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setError(null);
    try {
      await signOutUser();
      setUser(null);
      setClaims({
        role: "member",
        leadDomain: "None",
        title: "Guest",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign out.";
      setError(msg);
      throw err;
    }
  }, []);

  const handleRefreshClaims = useCallback(async () => {
    if (!user) return;
    try {
      const freshClaims = await refreshCurrentUserClaims(user);
      setClaims(freshClaims);
    } catch (err) {
      console.error("[DSC AuthContext] Error refreshing claims:", err);
    }
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: claims.role,
      leadDomain: claims.leadDomain,
      title: claims.title,
      isConfigured,
      loading,
      error,
      signInWithGoogle: handleSignInWithGoogle,
      signOut: handleSignOut,
      refreshClaims: handleRefreshClaims,
    }),
    [user, claims, isConfigured, loading, error, handleSignInWithGoogle, handleSignOut, handleRefreshClaims]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
