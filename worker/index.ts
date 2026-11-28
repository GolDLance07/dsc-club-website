/**
 * DSC VIT Bhopal — Cloudflare Worker Event Lifecycle Service
 *
 * Primary Worker Entry Point.
 *
 * Supported Endpoints:
 * - OPTIONS * : CORS preflight
 * - GET  /api/health : Worker health check
 * - POST /api/events/lifecycle : Super Admin event lifecycle mutations (publish, unpublish, archive)
 * - DELETE /api/events/:eventId : Super Admin event deletion
 * - POST /api/admin/assign-role : Super Admin Firebase Auth custom-claims role assignment
 */

import { verifyFirebaseIdToken, type VerifiedUser, AuthError } from "./auth.ts";
import { getFirestoreAccessToken, getIdentityToolkitAccessToken } from "./firestore.ts";
import {
  executeWorkerLifecycleTransition,
  executeWorkerEventDeletion,
  type LifecycleAction,
  LifecycleError,
} from "./lifecycle.ts";
import { executeWorkerRoleAssignment, RbacError } from "./rbac.ts";

export interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  ALLOWED_ORIGIN?: string;
}

const DEFAULT_ALLOWED_ORIGIN = "https://dscvitb.vercel.app";

function resolveAllowedOrigin(env: Env, request: Request): string {
  const rawAllowed = (env.ALLOWED_ORIGIN || "").trim();

  // Never allow wildcard CORS ("*") for authenticated Worker endpoints
  if (!rawAllowed || rawAllowed === "*") {
    return DEFAULT_ALLOWED_ORIGIN;
  }

  // Support single origin or comma-separated list for future Vercel -> Cloudflare Pages migration
  const allowedOrigins = rawAllowed
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== "*");

  if (allowedOrigins.length === 0) {
    return DEFAULT_ALLOWED_ORIGIN;
  }

  const requestOrigin = request.headers.get("Origin")?.trim();
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return allowedOrigins[0]!;
}

export function corsHeaders(env: Env, request: Request): HeadersInit {
  return {
    "Access-Control-Allow-Origin": resolveAllowedOrigin(env, request),
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
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
  } else if (err instanceof RbacError) {
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

      // Helper: Obtain Identity Toolkit Access Token
      const getIdentityToken = async (): Promise<string> => {
        if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
          throw new Error("Server configuration error: Firebase service account credentials missing in Worker secrets.");
        }
        return await getIdentityToolkitAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY);
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

      // 4. Route: DELETE /api/events/:eventId (Super Admin Only)
      const eventDeleteMatch = pathname.match(/^\/api\/events\/([^/]+)$/);
      if (eventDeleteMatch && request.method === "DELETE") {
        const eventId = eventDeleteMatch[1]!;
        const user = await authenticate();
        const accessToken = await getAccessToken();

        const result = await executeWorkerEventDeletion({
          projectId,
          firestoreAccessToken: accessToken,
          user,
          eventId,
        });

        return jsonResponse(result, 200, cors);
      }

      // 5. Route: POST /api/admin/assign-role (Super Admin Only)
      if (pathname === "/api/admin/assign-role" && request.method === "POST") {
        const user = await authenticate();
        const [accessToken, identityToken] = await Promise.all([
          getAccessToken(),
          getIdentityToken(),
        ]);

        const body = (await request.json().catch(() => ({}))) as {
          email?: string;
          fullName?: string;
          role?: string;
          leadDomain?: string;
          title?: string;
        };

        const result = await executeWorkerRoleAssignment({
          projectId,
          identityAccessToken: identityToken,
          firestoreAccessToken: accessToken,
          actor: user,
          targetEmail: body.email || "",
          fullName: body.fullName,
          role: body.role || "",
          leadDomain: body.leadDomain,
          title: body.title,
        });

        return jsonResponse(result, 200, cors);
      }

      return jsonResponse({ error: `Route "${request.method} ${pathname}" not found.` }, 404, cors);
    } catch (err) {
      return errorResponse(err, cors);
    }
  },
};
