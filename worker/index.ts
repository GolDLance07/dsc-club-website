/**
 * DSC VIT Bhopal — Cloudflare Worker Event Lifecycle & R2 Poster Service
 *
 * Primary Worker Entry Point.
 *
 * Supported Endpoints:
 * - OPTIONS * : CORS preflight
 * - GET  /api/health : Worker health check
 * - POST /api/events/lifecycle : Super Admin event lifecycle mutations (publish, unpublish, archive)
 * - POST /api/events/:eventId/posters : Authorized multi-poster upload to private R2
 * - DELETE /api/events/:eventId/posters/:posterId : Authorized poster deletion from R2
 * - GET  /api/posters/:eventId/:posterFile : Access-controlled poster retrieval
 */

import { verifyFirebaseIdToken, type VerifiedUser, AuthError } from "./auth.ts";
import { getFirestoreAccessToken } from "./firestore.ts";
import {
  uploadPosterToR2,
  deletePosterFromR2,
  servePosterFromR2,
  type R2BucketBinding,
  StorageError,
} from "./storage.ts";
import {
  executeWorkerLifecycleTransition,
  type LifecycleAction,
  LifecycleError,
} from "./lifecycle.ts";

export interface Env {
  POSTERS_BUCKET: R2BucketBinding;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  ALLOWED_ORIGIN?: string;
}

function corsHeaders(env: Env, request: Request): HeadersInit {
  const origin = request.headers.get("Origin") || "*";
  const allowed = env.ALLOWED_ORIGIN || "*";
  const allowOrigin = allowed === "*" || allowed === origin ? origin : allowed;

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function errorResponse(err: unknown, headers: HeadersInit = {}): Response {
  let status = 500;
  let message = "An internal server error occurred.";
  let details: unknown = undefined;

  if (err instanceof AuthError) {
    status = err.statusCode;
    message = err.message;
  } else if (err instanceof LifecycleError) {
    status = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof StorageError) {
    status = err.statusCode;
    message = err.message;
  } else if (err instanceof Error) {
    message = err.message;
    if ("statusCode" in err && typeof (err as { statusCode: number }).statusCode === "number") {
      status = (err as { statusCode: number }).statusCode;
    }
  }

  return jsonResponse({ error: message, details }, status, headers);
}

function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cors = corsHeaders(env, request);

    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const projectId = env.FIREBASE_PROJECT_ID || "dscvitb-ac7bf";

    try {
      // 2. Health Check
      if (pathname === "/api/health" || pathname === "/health") {
        return jsonResponse(
          {
            status: "ok",
            service: "dsc-event-lifecycle-worker",
            projectId,
            timestamp: new Date().toISOString(),
          },
          200,
          cors
        );
      }

      // Helper: Authenticate user
      const authenticate = async (): Promise<VerifiedUser> => {
        const token = extractBearerToken(request);
        if (!token) {
          throw new AuthError("Missing Bearer ID token in Authorization header.", 401);
        }
        return await verifyFirebaseIdToken(token, projectId);
      };

      // Helper: Obtain Firestore Access Token
      const getAccessToken = async (): Promise<string> => {
        if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
          throw new Error("Server configuration error: Firebase service account credentials missing in Worker secrets.");
        }
        return await getFirestoreAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY);
      };

      // 3. Route: POST /api/events/lifecycle
      if (pathname === "/api/events/lifecycle" && request.method === "POST") {
        const user = await authenticate();
        const accessToken = await getAccessToken();

        const body = (await request.json().catch(() => ({}))) as {
          action?: string;
          eventId?: string;
        };

        const result = await executeWorkerLifecycleTransition({
          projectId,
          firestoreAccessToken: accessToken,
          user,
          action: (body.action || "") as LifecycleAction,
          eventId: body.eventId || "",
        });

        return jsonResponse(result, 200, cors);
      }

      // 4. Route: POST /api/events/:eventId/posters
      const posterUploadMatch = pathname.match(/^\/api\/events\/([^/]+)\/posters$/);
      if (posterUploadMatch && request.method === "POST") {
        const eventId = posterUploadMatch[1]!;
        const user = await authenticate();
        const accessToken = await getAccessToken();

        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        if (!file) {
          throw new StorageError("Missing required 'file' in multipart/form-data request.", 400);
        }

        const caption = (formData.get("caption") as string) || undefined;
        const isPrimaryStr = formData.get("isPrimary");
        const isPrimary = isPrimaryStr !== null ? isPrimaryStr === "true" : undefined;

        const fileBytes = new Uint8Array(await file.arrayBuffer());

        const posterRecord = await uploadPosterToR2({
          r2Bucket: env.POSTERS_BUCKET,
          projectId,
          firestoreAccessToken: accessToken,
          user,
          eventId,
          fileBuffer: fileBytes,
          contentType: file.type || "image/webp",
          caption,
          isPrimary,
        });

        return jsonResponse({ success: true, poster: posterRecord }, 201, cors);
      }

      // 5. Route: DELETE /api/events/:eventId/posters/:posterId
      const posterDeleteMatch = pathname.match(/^\/api\/events\/([^/]+)\/posters\/([^/]+)$/);
      if (posterDeleteMatch && request.method === "DELETE") {
        const eventId = posterDeleteMatch[1]!;
        const posterId = posterDeleteMatch[2]!;
        const user = await authenticate();
        const accessToken = await getAccessToken();

        await deletePosterFromR2({
          r2Bucket: env.POSTERS_BUCKET,
          projectId,
          firestoreAccessToken: accessToken,
          user,
          eventId,
          posterId,
        });

        return jsonResponse({ success: true, deletedPosterId: posterId }, 200, cors);
      }

      // 6. Route: GET /api/posters/:eventId/:posterFile
      const posterServeMatch = pathname.match(/^\/api\/posters\/([^/]+)\/([^/]+)$/);
      if (posterServeMatch && request.method === "GET") {
        const eventId = posterServeMatch[1]!;
        const posterFile = posterServeMatch[2]!;

        // Optional token verification for draft inspection
        let user: VerifiedUser | null = null;
        const token = extractBearerToken(request);
        if (token) {
          try {
            user = await verifyFirebaseIdToken(token, projectId);
          } catch {
            // Ignore token error here; servePosterFromR2 will check if event is published
          }
        }

        const accessToken = await getAccessToken();

        const served = await servePosterFromR2({
          r2Bucket: env.POSTERS_BUCKET,
          projectId,
          firestoreAccessToken: accessToken,
          user,
          eventId,
          posterFile,
        });

        const headers = new Headers(cors);
        headers.set("Content-Type", served.contentType);
        headers.set("Cache-Control", served.cacheControl);
        if (served.etag) headers.set("ETag", served.etag);

        return new Response(served.body, {
          status: 200,
          headers,
        });
      }

      return jsonResponse({ error: `Route "${request.method} ${pathname}" not found.` }, 404, cors);
    } catch (err) {
      return errorResponse(err, cors);
    }
  },
};
