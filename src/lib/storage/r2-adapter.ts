/**
 * DSC VIT Bhopal — Cloudflare R2 Client Storage Adapter
 *
 * Replaces Firebase Storage with Cloudflare Worker R2 endpoints:
 * - Directs uploads to Worker endpoint: POST /api/events/:eventId/posters
 * - Directs deletions to Worker endpoint: DELETE /api/events/:eventId/posters/:posterId
 * - Authenticated blob retrieval for draft previews: GET /api/posters/:eventId/:posterFile
 * - No Firebase Storage SDK, Blaze billing, or Google Cloud Storage dependency.
 */

import { getFirebaseAuth } from "@/lib/firebase/auth";
import {
  validatePosterUpload,
  ALLOWED_POSTER_MIMES,
  MAX_POSTER_SIZE_BYTES,
} from "@/lib/shared/event-validation";
import type { EventPosterItem } from "@/types/models";

export function getWorkerApiBase(): string {
  const envUrl = (import.meta.env["VITE_WORKER_API_URL"] as string)?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  // In development, default to relative root which is intercepted by Vite dev server
  if (import.meta.env.DEV) {
    return "";
  }

  // In production, require explicit configuration
  console.error(
    "[DSC Cloudflare] Missing VITE_WORKER_API_URL environment variable. Cloudflare Worker API endpoint is not configured."
  );
  return "";
}

/**
 * Validates poster file format and size in browser before upload.
 */
export function validatePosterFile(file: File): { valid: boolean; error?: string } {
  const result = validatePosterUpload({
    contentType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    currentPostersCount: 0,
  });

  return {
    valid: result.valid,
    error: result.errors[0],
  };
}

/**
 * Measures image dimensions in browser memory.
 */
export function probeImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0 });
    };
    img.src = url;
  });
}

export interface UploadPosterResult {
  id: string;
  storagePath: string;
  url: string;
  caption?: string | undefined;
  isPrimary: boolean;
  displayOrder: number;
  width?: number | undefined;
  height?: number | undefined;
}

/**
 * Uploads an event poster to Cloudflare R2 via the trusted Worker API.
 * Supports flexible parameter signatures for backward-compatibility.
 */
export async function uploadEventPoster(
  eventId: string,
  file: File,
  posterIdOrCaption?: string,
  onProgressOrIsPrimary?: ((progressPct: number) => void) | boolean,
  maybeOnProgress?: (progressPct: number) => void
): Promise<UploadPosterResult> {
  let caption: string | undefined = undefined;
  let isPrimary: boolean | undefined = undefined;
  let onProgress: ((pct: number) => void) | undefined = undefined;

  if (typeof onProgressOrIsPrimary === "function") {
    onProgress = onProgressOrIsPrimary;
    caption = posterIdOrCaption;
  } else if (typeof onProgressOrIsPrimary === "boolean") {
    isPrimary = onProgressOrIsPrimary;
    caption = posterIdOrCaption;
    onProgress = maybeOnProgress;
  } else {
    caption = posterIdOrCaption;
  }

  const validation = validatePosterFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid poster file.");
  }

  const auth = getFirebaseAuth();
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error("Authentication Required: You must be logged in to upload posters.");
  }

  const idToken = await currentUser.getIdToken(true);
  const apiBase = getWorkerApiBase();
  const endpoint = `${apiBase}/api/events/${eventId}/posters`;

  const dimensions = await probeImageDimensions(file);

  const formData = new FormData();
  formData.append("file", file, file.name);
  if (caption) formData.append("caption", caption);
  if (isPrimary !== undefined) formData.append("isPrimary", String(isPrimary));

  if (onProgress) onProgress(30);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: formData,
  });

  if (onProgress) onProgress(80);

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      error?: string;
      details?: string[];
    };
    const msg = errorBody.error || `Upload failed with HTTP ${response.status}.`;
    throw new Error(msg);
  }

  if (onProgress) onProgress(100);

  const result = (await response.json()) as {
    success: boolean;
    poster: {
      id: string;
      storagePath: string;
      url: string;
      caption?: string;
      isPrimary: boolean;
      displayOrder: number;
    };
  };

  return {
    id: result.poster.id,
    storagePath: result.poster.storagePath,
    url: result.poster.url,
    caption: result.poster.caption || undefined,
    isPrimary: result.poster.isPrimary,
    displayOrder: result.poster.displayOrder,
    width: dimensions.width || undefined,
    height: dimensions.height || undefined,
  };
}

/**
 * Deletes a poster from Cloudflare R2 and updates Firestore via Worker API.
 * Supports both (eventId, posterId) and (storagePath).
 */
export async function deleteEventPoster(
  eventIdOrStoragePath: string,
  maybePosterId?: string
): Promise<void> {
  let eventId = eventIdOrStoragePath;
  let posterId = maybePosterId;

  if (!posterId && eventIdOrStoragePath.includes("events/")) {
    const match = eventIdOrStoragePath.match(/events\/([^/]+)\/posters\/([^/.]+)/);
    if (match && match[1] && match[2]) {
      eventId = match[1];
      posterId = match[2];
    }
  }

  if (!posterId) {
    console.warn("[DSC R2] Cannot determine posterId for delete, skipping:", eventIdOrStoragePath);
    return;
  }

  const auth = getFirebaseAuth();
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error("Authentication Required: You must be logged in to delete posters.");
  }

  const idToken = await currentUser.getIdToken(true);
  const apiBase = getWorkerApiBase();
  const endpoint = `${apiBase}/api/events/${eventId}/posters/${posterId}`;

  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorBody.error || `Failed to delete poster (HTTP ${response.status}).`);
  }
}

/**
 * Retrieves a private draft poster as an in-memory blob URL by passing Bearer authorization.
 */
export async function getAuthenticatedPosterBlob(posterUrl: string): Promise<string> {
  if (!posterUrl) return "";

  // If already an in-memory blob or base64 data URL, return as-is
  if (posterUrl.startsWith("blob:") || posterUrl.startsWith("data:")) {
    return posterUrl;
  }

  const auth = getFirebaseAuth();
  const currentUser = auth?.currentUser;
  const idToken = currentUser ? await currentUser.getIdToken() : null;

  const headers: Record<string, string> = {};
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  }

  const fullUrl = posterUrl.startsWith("http")
    ? posterUrl
    : `${getWorkerApiBase()}${posterUrl}`;

  try {
    const res = await fetch(fullUrl, { headers });
    if (!res.ok) {
      console.warn(`[DSC R2] Could not load draft poster blob (HTTP ${res.status})`);
      return "";
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn("[DSC R2] Failed to fetch authenticated poster blob:", err);
    return "";
  }
}
