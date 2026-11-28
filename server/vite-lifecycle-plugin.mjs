/**
 * DSC VIT Bhopal — Vite Dev Server Plugin for Cloudflare Worker Emulation
 *
 * Emulates the Cloudflare Worker endpoints in development:
 * - POST   /api/events/lifecycle : Authoritative event lifecycle state machine
 * - DELETE /api/events/:eventId  : Authoritative Super Admin event deletion
 */

import {
  getAdminAuth,
  getAdminDb,
  executeLifecycleTransition,
} from "./event-lifecycle-service.mjs";

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

        // 2. Route: DELETE /api/events/:eventId (Super Admin only)
        const eventDeleteMatch = pathname.match(/^\/api\/events\/([^/]+)$/);
        if (eventDeleteMatch && req.method === "DELETE") {
          const eventId = eventDeleteMatch[1];
          res.setHeader("Content-Type", "application/json");
          try {
            const user = await authenticate();
            if (user.role !== "super_admin") {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "Permission Denied: Only Super Admin can delete events." }));
              return;
            }

            const db = getAdminDb();
            const eventRef = db.collection("events").doc(eventId);
            const snap = await eventRef.get();
            if (!snap.exists) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: `Event "${eventId}" not found.` }));
              return;
            }

            const eventData = snap.data();
            await eventRef.delete();

            // Record activity log
            await db.collection("activity_logs").add({
              actorEmail: user.email || "super_admin@dscvitb.com",
              actorName: user.name || "Super Admin",
              actorRole: "super_admin",
              actionType: "EVENT_DELETE",
              targetModule: "Settings",
              targetEntityId: eventId,
              details: `Super Admin (${user.email}) permanently deleted event "${eventData.title || eventId}".`,
              timestamp: new Date().toISOString(),
            });

            res.statusCode = 200;
            res.end(
              JSON.stringify({
                success: true,
                deletedEventId: eventId,
                message: `Event "${eventData.title || eventId}" was successfully deleted.`,
              })
            );
          } catch (err) {
            res.statusCode = err.statusCode || 500;
            res.end(JSON.stringify({ error: err.message || "Event delete failed." }));
          }
          return;
        }

        // Pass to next middleware
        next();
      });
    },
  };
}
