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

        // 3. Route: POST /api/admin/assign-role (Super Admin only)
        if (pathname === "/api/admin/assign-role" && req.method === "POST") {
          let rawBody = "";
          req.on("data", (chunk) => (rawBody += chunk));
          req.on("end", async () => {
            res.setHeader("Content-Type", "application/json");
            try {
              const actor = await authenticate();
              if (actor.role !== "super_admin") {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "Permission Denied: Only Super Admin can assign roles." }));
                return;
              }

              const body = JSON.parse(rawBody || "{}");
              const targetEmail = (body.email || "").trim().toLowerCase();
              const role = body.role;
              const allowedRoles = ["super_admin", "faculty_coordinator", "team_lead", "member"];
              const allowedDomains = [
                "Technical",
                "AI & Data Science",
                "Design & Media",
                "Content & Editorial",
                "Management & PR",
              ];

              if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Invalid or missing target user email address." }));
                return;
              }

              if (targetEmail === (actor.email || "").trim().toLowerCase()) {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "Permission Denied: Administrators cannot modify their own role." }));
                return;
              }

              if (!allowedRoles.includes(role)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: `Invalid role "${role}".` }));
                return;
              }

              let leadDomain = "None";
              if (role === "team_lead") {
                if (!allowedDomains.includes(body.leadDomain)) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: `Invalid leadDomain "${body.leadDomain}" for team_lead.` }));
                  return;
                }
                leadDomain = body.leadDomain;
              }

              const title = (body.title || role).toString().trim().slice(0, 80);
              const adminAuth = getAdminAuth();
              let targetUser;
              try {
                targetUser = await adminAuth.getUserByEmail(targetEmail);
              } catch {
                res.statusCode = 404;
                res.end(
                  JSON.stringify({
                    error: `No Firebase Authentication account found for "${targetEmail}". Have the user sign in with Google once first, then retry.`,
                  })
                );
                return;
              }

              if (targetUser.uid === actor.uid) {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "Permission Denied: Administrators cannot modify their own role." }));
                return;
              }

              await adminAuth.setCustomUserClaims(targetUser.uid, { role, leadDomain, title });

              const db = getAdminDb();
              const fullName = (body.fullName || targetUser.displayName || targetEmail).toString().trim();
              const nowIso = new Date().toISOString();
              await db.collection("user_roles").doc(targetUser.uid).set(
                {
                  id: targetUser.uid,
                  userId: targetUser.uid,
                  email: targetEmail,
                  fullName,
                  role,
                  title,
                  leadDomain,
                  isActive: role !== "member",
                  assignedBy: actor.email || actor.uid,
                  updatedAt: nowIso,
                  createdAt: nowIso,
                },
                { merge: true }
              );

              await db.collection("activity_logs").add({
                actorEmail: actor.email || "super_admin@dscvitb.com",
                actorName: actor.name || "Super Admin",
                actorRole: "super_admin",
                actionType: role === "member" ? "REVOKE_ROLE" : "ASSIGN_ROLE",
                targetModule: "UserRole",
                targetEntityId: targetUser.uid,
                details: `Super Admin (${actor.email}) set role "${role}" (${title}, domain: ${leadDomain}) for ${targetEmail}.`,
                timestamp: nowIso,
              });

              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: true,
                  uid: targetUser.uid,
                  email: targetEmail,
                  fullName,
                  role,
                  leadDomain,
                  title,
                  message:
                    role === "member"
                      ? `Revoked management panel privileges for ${targetEmail}.`
                      : `Granted ${role} (${title}) privileges to ${targetEmail}. Ask them to sign out and sign back in to refresh their session.`,
                })
              );
            } catch (err) {
              res.statusCode = err.statusCode || 500;
              res.end(JSON.stringify({ error: err.message || "Role assignment failed." }));
            }
          });
          return;
        }

        // Pass to next middleware
        next();
      });
    },
  };
}
