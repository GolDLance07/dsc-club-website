/**
 * DSC VIT Bhopal — Cloudflare R2 Poster Storage & Worker-Controlled Access
 *
 * Implements:
 * - Private R2 storage for all posters (no public R2.dev bucket exposure).
 * - Authoritative server-side poster uploads with MIME and 5MB validation.
 * - Server-controlled key generation: events/{eventId}/posters/{posterId}.{ext}
 * - Access-controlled poster serving:
 *     - Published & archived event posters: served publicly with edge caching.
 *     - Draft event posters: strictly authenticated (Super Admin, Faculty, or domain-matched Team Lead).
 *     - Guessing paths to other domains' drafts returns 403/404.
 * - Server-side poster deletion from R2 & Firestore.
 */

import type { VerifiedUser } from "./auth.ts";
import { getEventDocument, patchEventDocument } from "./firestore.ts";
import { validatePosterUpload } from "../src/lib/shared/event-validation.ts";

export interface R2BucketBinding {
  put: (
    key: string,
    value: ReadableStream | ArrayBuffer | Uint8Array | string | Blob,
    options?: {
      httpMetadata?: {
        contentType?: string;
        cacheControl?: string;
      };
    }
  ) => Promise<unknown>;
  get: (key: string) => Promise<{
    body: ReadableStream;
    httpMetadata?: { contentType?: string };
    httpEtag?: string;
    size: number;
  } | null>;
  delete: (key: string | string[]) => Promise<unknown>;
}

export interface PosterRecord {
  id: string;
  storagePath: string; // R2 Object Key: events/{eventId}/posters/{posterId}.ext
  url: string; // Worker proxy URL: /api/posters/{eventId}/{posterFile}
  caption?: string;
  isPrimary: boolean;
  displayOrder: number;
  width?: number;
  height?: number;
  uploadedAt: string;
}

interface EventDataLike {
  title?: string;
  domainScope?: string;
  status?: string;
  posters?: PosterRecord[];
  [key: string]: unknown;
}

/**
 * Uploads a poster image to private R2 bucket and appends it to Firestore event document.
 */
export async function uploadPosterToR2(params: {
  r2Bucket: R2BucketBinding;
  projectId: string;
  firestoreAccessToken: string;
  user: VerifiedUser;
  eventId: string;
  fileBuffer: Uint8Array;
  contentType: string;
  caption?: string;
  isPrimary?: boolean;
}): Promise<PosterRecord> {
  const {
    r2Bucket,
    projectId,
    firestoreAccessToken,
    user,
    eventId,
    fileBuffer,
    contentType,
    caption,
  } = params;

  // 1. Fetch Event Document
  const eventDoc = await getEventDocument<EventDataLike>(projectId, firestoreAccessToken, eventId);
  if (!eventDoc) {
    throw new StorageError(`Event document "/events/${eventId}" does not exist.`, 404);
  }

  const event = eventDoc.data;
  const currentPosters = Array.isArray(event.posters) ? event.posters : [];

  // 2. Authorization Check
  if (user.role === "super_admin") {
    // Super Admin can upload to any event
  } else if (user.role === "team_lead") {
    if (event.domainScope !== user.leadDomain) {
      throw new StorageError(
        `Permission Denied: Team Lead (${user.leadDomain}) cannot upload posters to an event scoped to "${event.domainScope}".`,
        403
      );
    }
    if (event.status !== "draft") {
      throw new StorageError(
        `Permission Denied: Team Leads can only upload posters to draft events (current status: "${event.status}").`,
        403
      );
    }
  } else {
    throw new StorageError("Permission Denied: You do not have permission to upload posters.", 403);
  }

  // 3. Server-side Validation
  const validation = validatePosterUpload({
    contentType,
    sizeBytes: fileBuffer.byteLength,
    currentPostersCount: currentPosters.length,
  });

  if (!validation.valid) {
    throw new StorageError(`Poster validation failed:\n- ${validation.errors.join("\n- ")}`, 422);
  }

  // 4. Derive file extension & generate safe, unguessable R2 key
  let ext = "webp";
  const normalizedMime = contentType.toLowerCase().split(";")[0]?.trim();
  if (normalizedMime === "image/jpeg" || normalizedMime === "image/jpg") ext = "jpg";
  else if (normalizedMime === "image/png") ext = "png";

  const posterId = `poster_${crypto.randomUUID()}`;
  const r2Key = `events/${eventId}/posters/${posterId}.${ext}`;
  const publicServePath = `/api/posters/${eventId}/${posterId}.${ext}`;

  // 5. Store in Private Cloudflare R2
  await r2Bucket.put(r2Key, fileBuffer, {
    httpMetadata: {
      contentType: normalizedMime,
      cacheControl: "private, no-cache",
    },
  });

  // 6. Update Posters Array in Firestore
  const isFirst = currentPosters.length === 0;
  const shouldBePrimary = params.isPrimary ?? isFirst;

  const updatedPosters = currentPosters.map((p) => ({
    ...p,
    isPrimary: shouldBePrimary ? false : p.isPrimary,
  }));

  const newPosterItem: PosterRecord = {
    id: posterId,
    storagePath: r2Key,
    url: publicServePath,
    caption: caption || undefined,
    isPrimary: shouldBePrimary,
    displayOrder: updatedPosters.length + 1,
    uploadedAt: new Date().toISOString(),
  };

  updatedPosters.push(newPosterItem);

  await patchEventDocument(
    projectId,
    firestoreAccessToken,
    eventId,
    {
      posters: updatedPosters,
      updatedAt: new Date().toISOString(),
    },
    eventDoc.updateTime
  );

  return newPosterItem;
}

/**
 * Deletes a poster from R2 and removes it from Firestore event document.
 */
export async function deletePosterFromR2(params: {
  r2Bucket: R2BucketBinding;
  projectId: string;
  firestoreAccessToken: string;
  user: VerifiedUser;
  eventId: string;
  posterId: string;
}): Promise<void> {
  const { r2Bucket, projectId, firestoreAccessToken, user, eventId, posterId } = params;

  const eventDoc = await getEventDocument<EventDataLike>(projectId, firestoreAccessToken, eventId);
  if (!eventDoc) {
    throw new StorageError(`Event document "/events/${eventId}" does not exist.`, 404);
  }

  const event = eventDoc.data;
  const currentPosters = Array.isArray(event.posters) ? event.posters : [];
  const targetPoster = currentPosters.find((p) => p.id === posterId);

  if (!targetPoster) {
    throw new StorageError(`Poster "${posterId}" not found on event "${eventId}".`, 404);
  }

  // Authorization Check
  if (user.role === "super_admin") {
    // Super admin allowed
  } else if (user.role === "team_lead") {
    if (event.domainScope !== user.leadDomain) {
      throw new StorageError(
        `Permission Denied: Team Lead cannot delete posters from other domain "${event.domainScope}".`,
        403
      );
    }
    if (event.status !== "draft") {
      throw new StorageError(
        `Permission Denied: Team Leads can only delete posters from draft events.`,
        403
      );
    }
  } else {
    throw new StorageError("Permission Denied.", 403);
  }

  // Delete from R2
  await r2Bucket.delete(targetPoster.storagePath);

  // Update Firestore
  let updatedPosters = currentPosters.filter((p) => p.id !== posterId);

  // If deleted poster was primary and others remain, set first as primary
  if (targetPoster.isPrimary && updatedPosters.length > 0 && updatedPosters[0]) {
    updatedPosters[0].isPrimary = true;
  }

  // Re-index display orders
  updatedPosters = updatedPosters.map((p, idx) => ({
    ...p,
    displayOrder: idx + 1,
  }));

  await patchEventDocument(
    projectId,
    firestoreAccessToken,
    eventId,
    {
      posters: updatedPosters,
      updatedAt: new Date().toISOString(),
    },
    eventDoc.updateTime
  );
}

/**
 * Access-controlled poster retrieval stream from private R2.
 */
export async function servePosterFromR2(params: {
  r2Bucket: R2BucketBinding;
  projectId: string;
  firestoreAccessToken: string;
  user: VerifiedUser | null;
  eventId: string;
  posterFile: string;
  ifNoneMatch?: string | null;
}): Promise<{
  body?: ReadableStream;
  contentType: string;
  cacheControl: string;
  etag?: string;
  notModified?: boolean;
}> {
  const { r2Bucket, projectId, firestoreAccessToken, user, eventId, posterFile, ifNoneMatch } = params;

  // 1. Fetch Event Document from Firestore to verify access policy
  const eventDoc = await getEventDocument<EventDataLike>(projectId, firestoreAccessToken, eventId);
  if (!eventDoc) {
    throw new StorageError("Poster not found (invalid event).", 404);
  }

  const event = eventDoc.data;
  const isPubliclyAvailable = event.status === "published" || event.status === "archived";

  if (!isPubliclyAvailable) {
    // Draft poster: enforce strict authentication
    if (!user) {
      throw new StorageError("Unauthorized: Authentication required to preview draft posters.", 401);
    }

    const hasAccess =
      user.role === "super_admin" ||
      user.role === "faculty_coordinator" ||
      (user.role === "team_lead" && event.domainScope === user.leadDomain);

    if (!hasAccess) {
      throw new StorageError(
        "Forbidden: You do not have permission to inspect draft posters for this event.",
        403
      );
    }
  }

  // 2. Retrieve file from private R2
  const r2Key = `events/${eventId}/posters/${posterFile}`;
  const object = await r2Bucket.get(r2Key);
  if (!object) {
    throw new StorageError("Poster file not found in storage.", 404);
  }

  const contentType = object.httpMetadata?.contentType || "image/webp";
  // Published posters require revalidation (no-cache) so unpublishing immediately revokes public access
  const cacheControl = isPubliclyAvailable
    ? "public, no-cache, must-revalidate"
    : "private, no-store, no-cache, must-revalidate";

  // Conditional GET: If ETag matches, return 304 Not Modified
  if (isPubliclyAvailable && ifNoneMatch && object.httpEtag && ifNoneMatch === object.httpEtag) {
    return {
      contentType,
      cacheControl,
      etag: object.httpEtag,
      notModified: true,
    };
  }

  return {
    body: object.body,
    contentType,
    cacheControl,
    etag: object.httpEtag,
    notModified: false,
  };
}

export class StorageError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "StorageError";
    this.statusCode = statusCode;
  }
}
