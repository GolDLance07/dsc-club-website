/**
 * DSC VIT Bhopal — Vite Dev Server Plugin for Cloudflare Worker & R2 Emulation
 *
 * Emulates the Cloudflare Worker endpoints in development:
 * - POST   /api/events/lifecycle : Authoritative event lifecycle state machine
 * - POST   /api/events/:id/posters : Local R2 poster upload emulator
 * - DELETE /api/events/:id/posters/:posterId : Local R2 poster delete emulator
 * - GET    /api/posters/:id/:file : Access-controlled poster serving emulator
 */

import {
  getAdminAuth,
  getAdminDb,
  executeLifecycleTransition,
} from "./event-lifecycle-service.mjs";
import { validatePosterUpload } from "../src/lib/shared/event-validation.js";

// In-memory poster store for local R2 development emulation
const localR2Store = new Map(); // key -> { buffer, contentType }

export function eventLifecyclePlugin() {
  return {
    name: "event-lifecycle-api-middleware",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        const pathname = url.pathname;

        // Route: Health
        if (pathname === "/api/health") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ status: "ok", mode: "local-dev-emulator" }));
          return;
        }

        // Helper: Authenticate Bearer Token
        const authenticate = async () => {
          const authHeader = req.headers["authorization"] || "";
          if (!authHeader.startsWith("Bearer ")) {
            throw { statusCode: 401, message: "Missing Bearer ID token in Authorization header." };
          }
          const idToken = authHeader.split("Bearer ")[1].trim();
          const adminAuth = getAdminAuth();
          const decoded = await adminAuth.verifyIdToken(idToken);
          return {
            uid: decoded.uid,
            email: decoded.email || "",
            name: decoded.name || decoded.displayName || "Admin User",
            role: decoded.role || "member",
            leadDomain: decoded.leadDomain || "None",
          };
        };

        // 1. Route: POST /api/events/lifecycle
        if (pathname === "/api/events/lifecycle" && req.method === "POST") {
          let rawBody = "";
          req.on("data", (chunk) => (rawBody += chunk));
          req.on("end", async () => {
            res.setHeader("Content-Type", "application/json");
            try {
              const actor = await authenticate();
              const payload = JSON.parse(rawBody || "{}");
              const { action, eventId } = payload;

              const result = await executeLifecycleTransition({
                action,
                eventId,
                actor,
              });
              res.statusCode = 200;
              res.end(JSON.stringify(result));
            } catch (err) {
              const status = err.statusCode || (err.name === "SecurityError" ? 403 : 500);
              res.statusCode = status;
              res.end(JSON.stringify({ error: err.message, details: err.details }));
            }
          });
          return;
        }

        // 2. Route: POST /api/events/:eventId/posters
        const uploadMatch = pathname.match(/^\/api\/events\/([^/]+)\/posters$/);
        if (uploadMatch && req.method === "POST") {
          const eventId = uploadMatch[1];
          res.setHeader("Content-Type", "application/json");

          try {
            const user = await authenticate();
            const db = getAdminDb();
            const eventRef = db.collection("events").doc(eventId);
            const snap = await eventRef.get();

            if (!snap.exists) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: `Event "${eventId}" not found.` }));
              return;
            }

            const eventData = snap.data();
            const currentPosters = Array.isArray(eventData.posters) ? eventData.posters : [];

            // Authorization check
            if (user.role === "super_admin") {
              // Allowed
            } else if (user.role === "team_lead") {
              if (eventData.domainScope !== user.leadDomain) {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "Permission Denied: Cross-domain poster upload." }));
                return;
              }
              if (eventData.status !== "draft") {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "Permission Denied: Can only upload to draft events." }));
                return;
              }
            } else {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "Permission Denied." }));
              return;
            }

            // Parse multipart body using native Request
            const chunks = [];
            for await (const chunk of req) {
              chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);

            const webReq = new Request("http://localhost" + req.url, {
              method: "POST",
              headers: req.headers,
              body: buffer,
            });

            const formData = await webReq.formData();
            const file = formData.get("file");
            if (!file || typeof file === "string") {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Missing file in form data." }));
              return;
            }

            const caption = formData.get("caption") || undefined;
            const isPrimaryParam = formData.get("isPrimary");
            const isPrimary = isPrimaryParam !== null ? isPrimaryParam === "true" : currentPosters.length === 0;

            const fileBytes = new Uint8Array(await file.arrayBuffer());
            const validation = validatePosterUpload({
              contentType: file.type || "image/webp",
              sizeBytes: fileBytes.byteLength,
              currentPostersCount: currentPosters.length,
            });

            if (!validation.valid) {
              res.statusCode = 422;
              res.end(JSON.stringify({ error: validation.errors.join(", ") }));
              return;
            }

            let ext = "webp";
            if (file.type === "image/png") ext = "png";
            else if (file.type === "image/jpeg" || file.type === "image/jpg") ext = "jpg";

            const posterId = `poster_${crypto.randomUUID()}`;
            const r2Key = `events/${eventId}/posters/${posterId}.${ext}`;
            const serveUrl = `/api/posters/${eventId}/${posterId}.${ext}`;

            // Save in local R2 memory store
            localR2Store.set(r2Key, {
              buffer: Buffer.from(fileBytes),
              contentType: file.type || "image/webp",
            });

            // Update Firestore document
            let updatedPosters = currentPosters.map((p) => ({
              ...p,
              isPrimary: isPrimary ? false : p.isPrimary,
            }));

            const newPosterItem = {
              id: posterId,
              storagePath: r2Key,
              url: serveUrl,
              caption: caption || undefined,
              isPrimary,
              displayOrder: updatedPosters.length + 1,
              uploadedAt: new Date().toISOString(),
            };

            updatedPosters.push(newPosterItem);

            await eventRef.update({
              posters: updatedPosters,
              updatedAt: new Date().toISOString(),
            });

            res.statusCode = 201;
            res.end(JSON.stringify({ success: true, poster: newPosterItem }));
          } catch (err) {
            console.error("[Local Poster Upload Error]", err);
            res.statusCode = err.statusCode || 500;
            res.end(JSON.stringify({ error: err.message || "Upload failed." }));
          }
          return;
        }

        // 3. Route: DELETE /api/events/:eventId/posters/:posterId
        const deleteMatch = pathname.match(/^\/api\/events\/([^/]+)\/posters\/([^/]+)$/);
        if (deleteMatch && req.method === "DELETE") {
          const eventId = deleteMatch[1];
          const posterId = deleteMatch[2];
          res.setHeader("Content-Type", "application/json");

          try {
            const user = await authenticate();
            const db = getAdminDb();
            const eventRef = db.collection("events").doc(eventId);
            const snap = await eventRef.get();

            if (!snap.exists) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: `Event "${eventId}" not found.` }));
              return;
            }

            const eventData = snap.data();
            const currentPosters = Array.isArray(eventData.posters) ? eventData.posters : [];
            const target = currentPosters.find((p) => p.id === posterId);

            if (!target) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: `Poster "${posterId}" not found.` }));
              return;
            }

            if (user.role === "super_admin") {
              // Allowed
            } else if (user.role === "team_lead") {
              if (eventData.domainScope !== user.leadDomain || eventData.status !== "draft") {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "Permission Denied." }));
                return;
              }
            } else {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "Permission Denied." }));
              return;
            }

            // Remove from local memory R2 store
            localR2Store.delete(target.storagePath);

            let updatedPosters = currentPosters.filter((p) => p.id !== posterId);
            if (target.isPrimary && updatedPosters.length > 0 && updatedPosters[0]) {
              updatedPosters[0].isPrimary = true;
            }
            updatedPosters = updatedPosters.map((p, idx) => ({ ...p, displayOrder: idx + 1 }));

            await eventRef.update({
              posters: updatedPosters,
              updatedAt: new Date().toISOString(),
            });

            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, deletedPosterId: posterId }));
          } catch (err) {
            res.statusCode = err.statusCode || 500;
            res.end(JSON.stringify({ error: err.message || "Delete failed." }));
          }
          return;
        }

        // 4. Route: GET /api/posters/:eventId/:posterFile
        const serveMatch = pathname.match(/^\/api\/posters\/([^/]+)\/([^/]+)$/);
        if (serveMatch && req.method === "GET") {
          const eventId = serveMatch[1];
          const posterFile = serveMatch[2];

          try {
            const db = getAdminDb();
            const eventRef = db.collection("events").doc(eventId);
            const snap = await eventRef.get();

            if (!snap.exists) {
              res.statusCode = 404;
              res.end("Not Found");
              return;
            }

            const eventData = snap.data();
            const isPublic = eventData.status === "published" || eventData.status === "archived";

            if (!isPublic) {
              // Enforce draft privacy
              const user = await authenticate().catch(() => null);
              if (!user) {
                res.statusCode = 401;
                res.end("Unauthorized");
                return;
              }
              const hasAccess =
                user.role === "super_admin" ||
                user.role === "faculty_coordinator" ||
                (user.role === "team_lead" && eventData.domainScope === user.leadDomain);

              if (!hasAccess) {
                res.statusCode = 403;
                res.end("Forbidden");
                return;
              }
            }

            const r2Key = `events/${eventId}/posters/${posterFile}`;
            const stored = localR2Store.get(r2Key);
            if (!stored) {
              res.statusCode = 404;
              res.end("Poster not found");
              return;
            }

            res.statusCode = 200;
            res.setHeader("Content-Type", stored.contentType);
            res.setHeader("Cache-Control", isPublic ? "public, max-age=86400" : "private, no-cache");
            res.end(stored.buffer);
          } catch (err) {
            res.statusCode = 500;
            res.end("Internal Server Error");
          }
          return;
        }

        // Pass to next middleware
        next();
      });
    },
  };
}
