/**
 * DSC VIT Bhopal — Centralized Firebase Client Configuration
 *
 * Implements safe, defensive initialization:
 * - Validates presence of environment variables before calling Firebase SDK.
 * - If unconfigured, exports null instances and isFirebaseConfigured() = false.
 * - Prevents client crashes during module import, SSR, or unconfigured builds.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

const rawConfig: Partial<FirebaseClientConfig> = {
  apiKey: (import.meta.env["VITE_FIREBASE_API_KEY"] as string) || "",
  authDomain: (import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] as string) || "",
  projectId: (import.meta.env["VITE_FIREBASE_PROJECT_ID"] as string) || "",
  storageBucket: (import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"] as string) || "",
  messagingSenderId: (import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] as string) || "",
  appId: (import.meta.env["VITE_FIREBASE_APP_ID"] as string) || "",
  measurementId: (import.meta.env["VITE_FIREBASE_MEASUREMENT_ID"] as string) || "",
};

/**
 * Returns true if all mandatory Firebase client configuration values are provided.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    rawConfig.apiKey &&
    rawConfig.apiKey.trim() !== "" &&
    rawConfig.projectId &&
    rawConfig.projectId.trim() !== "" &&
    rawConfig.appId &&
    rawConfig.appId.trim() !== ""
  );
}

let firebaseAppInstance: FirebaseApp | null = null;

/**
 * Lazily retrieves or initializes the singleton FirebaseApp instance.
 * Returns null if required environment configuration is missing.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (firebaseAppInstance) {
    return firebaseAppInstance;
  }

  if (!isFirebaseConfigured()) {
    if (import.meta.env.DEV) {
      console.info(
        "[DSC Firebase] Client configuration is not set in environment. Running in unconfigured fallback mode."
      );
    }
    return null;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseAppInstance = existingApps[0]!;
    return firebaseAppInstance;
  }

  try {
    firebaseAppInstance = initializeApp(rawConfig as FirebaseClientConfig);
    return firebaseAppInstance;
  } catch (error) {
    console.error("[DSC Firebase] Failed to initialize FirebaseApp:", error);
    return null;
  }
}

export const firebaseConfig = rawConfig;
