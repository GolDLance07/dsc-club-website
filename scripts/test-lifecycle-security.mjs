#!/usr/bin/env node
/**
 * DSC VIT Bhopal — Event Lifecycle & Security Test Suite
 *
 * Verifies:
 * 1. Worker & Server Authorization: only 'super_admin' can execute lifecycle transitions & deletions, plus CORS enforcement.
 * 2. Shared Pure Validation: title, descriptions, dates, venue, domain (no posters required).
 * 3. Static assertion of Firestore security rules denying client status updates & deletions.
 * 4. End-to-end Firestore execution and activity logging without R2 or poster dependencies.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import crypto from "node:crypto";
import "dotenv/config";

import {
  getAdminDb,
  executeLifecycleTransition,
  SecurityError,
  ValidationError,
  StateTransitionError,
} from "../server/event-lifecycle-service.mjs";

import {
  validateEventForPublish,
} from "../src/lib/shared/event-validation.ts";

import {
  verifyFirebaseIdToken,
  AuthError,
} from "../worker/auth.ts";

import {
  executeWorkerEventDeletion,
  LifecycleError,
} from "../worker/lifecycle.ts";

import {
  getFirestoreAccessToken,
  ConcurrencyError,
} from "../worker/firestore.ts";

import workerHandler, {
  corsHeaders,
} from "../worker/index.ts";

// =========================================================================
// 1. Worker Authorization & Token Verification
// =========================================================================
describe("1. Worker Authorization & Token Verification", () => {
  const dummyEventId = "security-test-event";

  test("Rejects unauthenticated or missing actor role with SecurityError (403)", async () => {
    await assert.rejects(
      async () => {
        await executeLifecycleTransition({
          action: "publish",
          eventId: dummyEventId,
          actor: { uid: "anon-1", email: "anon@test.com", role: undefined },
        });
      },
      (err) => {
        assert(err instanceof SecurityError);
        assert.equal(err.statusCode, 403);
        assert(err.message.includes("super_admin"));
        return true;
      }
    );
  });

  test("Rejects 'member' role with SecurityError (403)", async () => {
    await assert.rejects(
      async () => {
        await executeLifecycleTransition({
          action: "publish",
          eventId: dummyEventId,
          actor: { uid: "member-1", email: "member@dscvitb.com", role: "member" },
        });
      },
      (err) => {
        assert(err instanceof SecurityError);
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });

  test("Rejects 'team_lead' role from lifecycle actions with SecurityError (403)", async () => {
    await assert.rejects(
      async () => {
        await executeLifecycleTransition({
          action: "publish",
          eventId: dummyEventId,
          actor: { uid: "lead-1", email: "lead@dscvitb.com", role: "team_lead" },
        });
      },
      (err) => {
        assert(err instanceof SecurityError);
        assert.equal(err.statusCode, 403);
        assert(err.message.includes("super_admin"));
        return true;
      }
    );
  });

  test("Rejects 'faculty_coordinator' role from lifecycle actions with SecurityError (403)", async () => {
    await assert.rejects(
      async () => {
        await executeLifecycleTransition({
          action: "publish",
          eventId: dummyEventId,
          actor: { uid: "faculty-1", email: "faculty@dscvitb.com", role: "faculty_coordinator" },
        });
      },
      (err) => {
        assert(err instanceof SecurityError);
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });

  test("Worker auth: Rejects empty or missing token string with AuthError (401)", async () => {
    await assert.rejects(
      async () => {
        await verifyFirebaseIdToken("", "dscvitb-ac7bf");
      },
      (err) => {
        assert(err instanceof AuthError);
        assert.equal(err.statusCode, 401);
        return true;
      }
    );
  });

  test("Worker auth: Rejects malformed JWT segments with AuthError (401)", async () => {
    await assert.rejects(
      async () => {
        await verifyFirebaseIdToken("invalid.jwt", "dscvitb-ac7bf");
      },
      (err) => {
        assert(err instanceof AuthError);
        assert.equal(err.statusCode, 401);
        return true;
      }
    );
  });

  test("Worker auth: Rejects expired JWT token with AuthError (401)", async () => {
    const expiredHeader = btoa(JSON.stringify({ alg: "RS256", kid: "test-kid" })).replace(/=/g, "");
    const expiredPayload = btoa(
      JSON.stringify({
        iss: "https://securetoken.google.com/dscvitb-ac7bf",
        aud: "dscvitb-ac7bf",
        sub: "user-123",
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      })
    ).replace(/=/g, "");
    const fakeSig = btoa("fakesig").replace(/=/g, "");

    const token = `${expiredHeader}.${expiredPayload}.${fakeSig}`;

    await assert.rejects(
      async () => {
        await verifyFirebaseIdToken(token, "dscvitb-ac7bf");
      },
      (err) => {
        assert(err instanceof AuthError);
        assert.equal(err.statusCode, 401);
        assert(err.message.includes("expired"));
        return true;
      }
    );
  });

  // --- Real Cryptographic Firebase ID Token Tests (WebCrypto RS256) ---
  const projectId = "dscvitb-ac7bf";
  let rsaKeyPair;
  let testPublicJwk;
  let mockJwks;

  test("Generate real RSA key pair for cryptographic token test suite", async () => {
    rsaKeyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"]
    );
    testPublicJwk = await crypto.subtle.exportKey("jwk", rsaKeyPair.publicKey);
    testPublicJwk.kid = "test-crypto-kid-1";
    testPublicJwk.alg = "RS256";
    testPublicJwk.use = "sig";
    mockJwks = [testPublicJwk];
    assert.equal(testPublicJwk.kid, "test-crypto-kid-1");
  });

  async function createSignedToken(headerOverrides = {}, payloadOverrides = {}, key = rsaKeyPair.privateKey) {
    const header = { alg: "RS256", kid: "test-crypto-kid-1", ...headerOverrides };
    const nowSec = Math.floor(Date.now() / 1000);
    const payload = {
      iss: `https://securetoken.google.com/${projectId}`,
      aud: projectId,
      sub: "test-user-uid-123",
      email: "testuser@dscvitb.com",
      name: "Test User",
      iat: nowSec,
      exp: nowSec + 3600,
      ...payloadOverrides,
    };
    const encHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
    const encPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const data = new TextEncoder().encode(`${encHeader}.${encPayload}`);
    const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data);
    const encSig = Buffer.from(sig).toString("base64url");
    return `${encHeader}.${encPayload}.${encSig}`;
  }

  test("ID Token Verification: Rejects invalid cryptographic signature with AuthError (401)", async () => {
    const validToken = await createSignedToken();
    const [h, p, s] = validToken.split(".");
    // Tamper with one character in signature
    const tamperedSig = s.slice(0, -2) + (s.slice(-2) === "aa" ? "bb" : "aa");
    const tamperedToken = `${h}.${p}.${tamperedSig}`;

    await assert.rejects(
      async () => {
        await verifyFirebaseIdToken(tamperedToken, projectId, mockJwks);
      },
      (err) => {
        assert(err instanceof AuthError);
        assert.equal(err.statusCode, 401);
        assert(err.message.includes("signature"));
        return true;
      }
    );
  });

  test("ID Token Verification: Rejects token signed by different unknown private key (401)", async () => {
    const rogueKeyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"]
    );
    const rogueToken = await createSignedToken({}, {}, rogueKeyPair.privateKey);

    await assert.rejects(
      async () => {
        await verifyFirebaseIdToken(rogueToken, projectId, mockJwks);
      },
      (err) => {
        assert(err instanceof AuthError);
        assert.equal(err.statusCode, 401);
        assert(err.message.includes("signature"));
        return true;
      }
    );
  });

  test("ID Token Verification: Rejects token with wrong issuer (401)", async () => {
    const badIssToken = await createSignedToken({}, { iss: "https://securetoken.google.com/wrong-project" });
    await assert.rejects(
      async () => {
        await verifyFirebaseIdToken(badIssToken, projectId, mockJwks);
      },
      (err) => {
        assert(err instanceof AuthError);
        assert.equal(err.statusCode, 401);
        assert(err.message.includes("issuer"));
        return true;
      }
    );
  });

  test("ID Token Verification: Rejects token with wrong audience (401)", async () => {
    const badAudToken = await createSignedToken({}, { aud: "wrong-audience" });
    await assert.rejects(
      async () => {
        await verifyFirebaseIdToken(badAudToken, projectId, mockJwks);
      },
      (err) => {
        assert(err instanceof AuthError);
        assert.equal(err.statusCode, 401);
        assert(err.message.includes("audience"));
        return true;
      }
    );
  });

  test("ID Token Verification: Rejects token with unknown kid not found in JWKS (401)", async () => {
    const unknownKidToken = await createSignedToken({ kid: "unregistered-kid-999" });
    await assert.rejects(
      async () => {
        await verifyFirebaseIdToken(unknownKidToken, projectId, mockJwks);
      },
      (err) => {
        assert(err instanceof AuthError);
        assert.equal(err.statusCode, 401);
        assert(err.message.includes("not found in Google JWKS"));
        return true;
      }
    );
  });

  test("ID Token Verification: Rejects cryptographically signed but expired token (401)", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const expiredToken = await createSignedToken({}, { exp: nowSec - 60, iat: nowSec - 3600 });
    await assert.rejects(
      async () => {
        await verifyFirebaseIdToken(expiredToken, projectId, mockJwks);
      },
      (err) => {
        assert(err instanceof AuthError);
        assert.equal(err.statusCode, 401);
        assert(err.message.includes("expired"));
        return true;
      }
    );
  });

  test("ID Token Verification: Valid token with missing custom role claims defaults safely to 'member'", async () => {
    // No role property in payload
    const tokenNoRole = await createSignedToken({}, { role: undefined });
    const verified = await verifyFirebaseIdToken(tokenNoRole, projectId, mockJwks);
    assert.equal(verified.role, "member");
    assert.equal(verified.leadDomain, "None");

    // Must be rejected by lifecycle service because member is unauthorized
    await assert.rejects(
      async () => {
        await executeLifecycleTransition({
          action: "publish",
          eventId: dummyEventId,
          actor: verified,
        });
      },
      (err) => {
        assert(err instanceof SecurityError);
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });

  test("ID Token Verification: Valid token with unauthorized role claim ('team_lead') is rejected by lifecycle (403)", async () => {
    const teamLeadToken = await createSignedToken({}, { role: "team_lead", leadDomain: "Technical" });
    const verified = await verifyFirebaseIdToken(teamLeadToken, projectId, mockJwks);
    assert.equal(verified.role, "team_lead");
    assert.equal(verified.leadDomain, "Technical");

    await assert.rejects(
      async () => {
        await executeLifecycleTransition({
          action: "publish",
          eventId: dummyEventId,
          actor: verified,
        });
      },
      (err) => {
        assert(err instanceof SecurityError);
        assert.equal(err.statusCode, 403);
        assert(err.message.includes("super_admin"));
        return true;
      }
    );
  });

  test("ID Token Verification: Valid token with unauthorized role claim ('faculty_coordinator') is rejected by lifecycle (403)", async () => {
    const facultyToken = await createSignedToken({}, { role: "faculty_coordinator" });
    const verified = await verifyFirebaseIdToken(facultyToken, projectId, mockJwks);
    assert.equal(verified.role, "faculty_coordinator");

    await assert.rejects(
      async () => {
        await executeLifecycleTransition({
          action: "publish",
          eventId: dummyEventId,
          actor: verified,
        });
      },
      (err) => {
        assert(err instanceof SecurityError);
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });

  test("ID Token Verification: Valid token with 'super_admin' role claim authorizes successfully", async () => {
    const superAdminToken = await createSignedToken({}, { role: "super_admin", email: "president@dscvitb.com" });
    const verified = await verifyFirebaseIdToken(superAdminToken, projectId, mockJwks);
    assert.equal(verified.role, "super_admin");
    assert.equal(verified.email, "president@dscvitb.com");
  });

  test("Worker CORS: wrangler.jsonc enforces exact Vercel origin without wildcard", () => {
    const wranglerRaw = fs.readFileSync(path.resolve(process.cwd(), "wrangler.jsonc"), "utf-8");
    assert(wranglerRaw.includes('"ALLOWED_ORIGIN": "https://dscvitb.vercel.app"'));
    assert(!wranglerRaw.includes('"ALLOWED_ORIGIN": "*"'));
  });

  test("Worker CORS: Preflight OPTIONS returns 204 with exact origin, required methods, and headers", async () => {
    const req = new Request("https://worker.test/api/events/lifecycle", {
      method: "OPTIONS",
      headers: {
        Origin: "https://dscvitb.vercel.app",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Authorization, Content-Type",
      },
    });
    const env = { ALLOWED_ORIGIN: "https://dscvitb.vercel.app", FIREBASE_PROJECT_ID: projectId };
    const res = await workerHandler.fetch(req, env, {});

    assert.equal(res.status, 204);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), "https://dscvitb.vercel.app");
    assert.equal(res.headers.get("Access-Control-Allow-Methods"), "GET, POST, PATCH, DELETE, OPTIONS");
    assert.equal(res.headers.get("Access-Control-Allow-Headers"), "Authorization, Content-Type");
  });

  test("Worker CORS: Rejects wildcard fallback and shields authenticated API from untrusted origins", async () => {
    const req = new Request("https://worker.test/api/events/lifecycle", {
      method: "POST",
      headers: {
        Origin: "https://evil-attacker.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "publish", eventId: "x" }),
    });
    // Even if ALLOWED_ORIGIN were mistakenly "*", worker must not emit wildcard
    const wildcardHeaders = new Headers(corsHeaders({ ALLOWED_ORIGIN: "*" }, req));
    assert.equal(wildcardHeaders.get("Access-Control-Allow-Origin"), "https://dscvitb.vercel.app");

    const env = { ALLOWED_ORIGIN: "https://dscvitb.vercel.app", FIREBASE_PROJECT_ID: projectId };
    const res = await workerHandler.fetch(req, env, {});
    assert.equal(res.status, 401);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), "https://dscvitb.vercel.app");
    assert.notEqual(res.headers.get("Access-Control-Allow-Origin"), "*");
  });

  test("Worker CORS: Supports comma-separated migration origins for future Cloudflare Pages transition", () => {
    const env = { ALLOWED_ORIGIN: "https://dscvitb.vercel.app, https://dscvitb.pages.dev" };
    const pagesReq = new Request("https://worker.test/api/health", {
      headers: { Origin: "https://dscvitb.pages.dev" },
    });
    const vercelReq = new Request("https://worker.test/api/health", {
      headers: { Origin: "https://dscvitb.vercel.app" },
    });

    assert.equal(
      new Headers(corsHeaders(env, pagesReq)).get("Access-Control-Allow-Origin"),
      "https://dscvitb.pages.dev"
    );
    assert.equal(
      new Headers(corsHeaders(env, vercelReq)).get("Access-Control-Allow-Origin"),
      "https://dscvitb.vercel.app"
    );
  });
});

// =========================================================================
// 2. Shared Pure Validation Module Checks
// =========================================================================
describe("2. Shared Pure Validation Module Checks", () => {
  const validBaseEvent = {
    title: "Autonomous Agents in Production",
    description: "An intensive sprint exploring autonomous tool use and LLM orchestration architectures.",
    longBio: "This full-day hands-on workshop covers building autonomous agent workflows using modern agent protocols, safe sandboxed execution environments, and real-time observability pipelines.",
    venue: "Main Auditorium, Academic Block 1",
    timeDisplay: "10:00 AM - 5:00 PM IST",
    domainScope: "AI & Data Science",
    startDate: "2026-10-15T10:00:00.000Z",
    endDate: "2026-10-15T17:00:00.000Z",
    registrationDeadline: "2026-10-14T23:59:59.000Z",
  };

  test("Passes when all event details and dates conform to requirements (no poster required)", () => {
    const result = validateEventForPublish(validBaseEvent);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  test("Fails if title is shorter than 5 characters", () => {
    const result = validateEventForPublish({ ...validBaseEvent, title: "LLM" });
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.includes("Title must be at least 5 characters")));
  });

  test("Fails if description overview is shorter than 20 characters", () => {
    const result = validateEventForPublish({ ...validBaseEvent, description: "Too short desc" });
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.includes("Description overview must be at least 20 characters")));
  });

  test("Fails if longBio is shorter than 50 characters", () => {
    const result = validateEventForPublish({ ...validBaseEvent, longBio: "Short briefing statement." });
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.includes("Detailed briefing (longBio) must be at least 50 characters")));
  });

  test("Fails if domainScope is not an authorized club domain", () => {
    const result = validateEventForPublish({ ...validBaseEvent, domainScope: "InvalidDomain" });
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.includes("Invalid domainScope")));
  });

  test("Fails if endDate occurs before startDate", () => {
    const result = validateEventForPublish({
      ...validBaseEvent,
      startDate: "2026-10-15T10:00:00.000Z",
      endDate: "2026-10-14T10:00:00.000Z",
    });
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.includes("End date cannot occur before start date")));
  });

  test("Fails if registrationDeadline occurs after startDate", () => {
    const result = validateEventForPublish({
      ...validBaseEvent,
      startDate: "2026-10-15T10:00:00.000Z",
      registrationDeadline: "2026-10-16T10:00:00.000Z",
    });
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.includes("Registration deadline cannot occur after event starts")));
  });

  test("Fails if venue or timeDisplay is missing", () => {
    const missingVenue = validateEventForPublish({ ...validBaseEvent, venue: "   " });
    assert.equal(missingVenue.valid, false);
    assert(missingVenue.errors.some((e) => e.includes("Venue / location is required")));

    const missingTime = validateEventForPublish({ ...validBaseEvent, timeDisplay: "" });
    assert.equal(missingTime.valid, false);
    assert(missingTime.errors.some((e) => e.includes("Time display string is required")));
  });
});

// =========================================================================
// 3. Firestore Security Rules Client-Side Denial Static Assertions
// =========================================================================
describe("3. Firestore Security Rules Client-Side Denial Static Assertions", () => {
  const rulesPath = path.resolve(process.cwd(), "firestore.rules");
  const rulesContent = fs.readFileSync(rulesPath, "utf-8");

  test("Enforces client-side status immutability: request.resource.data.status == resource.data.status", () => {
    assert(
      rulesContent.includes("request.resource.data.status == resource.data.status"),
      "firestore.rules must enforce status immutability for all client updates"
    );
  });

  test("Disallows client update from setting status to 'published'", () => {
    const hasClientPublish = rulesContent.includes("request.resource.data.status in ['published']");
    assert.equal(hasClientPublish, false, "Client rules must NOT allow transitioning to published");
  });

  test("Protects createdBy and createdAt from modification", () => {
    assert(rulesContent.includes("request.resource.data.createdBy == resource.data.createdBy"));
    assert(rulesContent.includes("request.resource.data.createdAt == resource.data.createdAt"));
  });

  test("Protects currentRegistrations counter from client modification", () => {
    assert(rulesContent.includes("request.resource.data.currentRegistrations == resource.data.currentRegistrations"));
  });

  test("Protects lifecycle timestamps ('publishedAt', 'archivedAt') from client forgery", () => {
    assert(rulesContent.includes("request.resource.data.publishedAt == resource.data.publishedAt"));
    assert(rulesContent.includes("request.resource.data.archivedAt == resource.data.archivedAt"));
  });

  test("Client-side event deletion is strictly disabled in Firestore rules (allow delete: if false;)", () => {
    assert(
      rulesContent.includes("allow delete: if false;"),
      "firestore.rules must disable client-side event deletion so all deletes go through trusted Worker API"
    );
  });

  test("Public read rules allow only published and archived events, protecting drafts", () => {
    const eventsBlock = rulesContent
      .split("match /events/{eventId}")[1]
      .split("match /registrations/{regId}")[0];
    assert(
      eventsBlock.includes("allow read: if resource.data.status in ['published', 'archived']"),
      "firestore.rules must allow public reads strictly on published or archived events"
    );
    assert(
      !eventsBlock.includes("allow read: if true"),
      "Events collection must never allow unconditional public read"
    );
  });

  test("Firestore indexes match public and domain-scoped admin queries", () => {
    const indexesJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "firestore.indexes.json"), "utf-8")
    );
    const eventIndexes = indexesJson.indexes.filter((idx) => idx.collectionGroup === "events");
    const hasPublicIndex = eventIndexes.some(
      (idx) =>
        idx.fields.some((f) => f.fieldPath === "status") &&
        idx.fields.some((f) => f.fieldPath === "startDate" && f.order === "ASCENDING")
    );
    const hasLeadIndex = eventIndexes.some(
      (idx) =>
        idx.fields.some((f) => f.fieldPath === "domainScope") &&
        idx.fields.some((f) => f.fieldPath === "createdAt" && f.order === "DESCENDING")
    );
    assert(hasPublicIndex, "Missing composite index on events (status, startDate ASC)");
    assert(hasLeadIndex, "Missing composite index on events (domainScope, createdAt DESC)");
  });

  test("Cloudflare Pages SPA _redirects, Vercel fallback, and zero duplicate siloData", () => {
    const redirects = fs.readFileSync(path.resolve(process.cwd(), "public/_redirects"), "utf-8");
    assert(redirects.includes("/index.html") && redirects.includes("200"));
    const vercelConfig = fs.readFileSync(path.resolve(process.cwd(), "vercel.json"), "utf-8");
    assert(vercelConfig.includes("/index.html"));
    assert.equal(fs.existsSync(path.resolve(process.cwd(), "src/components/silo/siloData.ts")), false);
  });
});

// =========================================================================
// 4. End-to-End Database Lifecycle Execution & Audit Trail
// =========================================================================
describe("4. End-to-End Database Lifecycle Execution & Audit Trail", () => {
  const db = getAdminDb();
  let firestoreToken = "";
  const testEventId = "security-test-cf-" + Date.now();
  const superAdminActor = {
    uid: "test-super-admin-uid",
    email: "superadmin.test@dscvitb.com",
    name: "Test President",
    role: "super_admin",
  };

  test("Setup: Seed draft event in Firestore without posters", async () => {
    const saPath = path.resolve(process.cwd(), "serviceAccountKey.json");
    const sa = JSON.parse(fs.readFileSync(saPath, "utf-8"));
    firestoreToken = await getFirestoreAccessToken(sa.client_email, sa.private_key);
    assert(firestoreToken.length > 0);

    const eventRef = db.collection("events").doc(testEventId);
    await eventRef.set({
      id: testEventId,
      slug: testEventId,
      title: "Verified AI Systems Sprint",
      description: "A comprehensive hands-on workshop covering hardware-accelerated deep learning architectures.",
      longBio: "Participants will build custom PyTorch tensors, construct convolutional classification heads, optimize gradient descent computation graphs, and deploy ONNX models on local edge hardware.",
      venue: "Lab Complex 3, Room 302",
      timeDisplay: "09:30 AM - 04:30 PM IST",
      domainScope: "AI & Data Science",
      startDate: new Date("2026-11-20T09:30:00+05:30").toISOString(),
      endDate: new Date("2026-11-20T16:30:00+05:30").toISOString(),
      registrationDeadline: new Date("2026-11-19T23:59:59+05:30").toISOString(),
      status: "draft",
      category: "BOOTCAMP",
      maxCapacity: 100,
      currentRegistrations: 0,
      createdBy: {
        uid: superAdminActor.uid,
        email: superAdminActor.email,
        name: superAdminActor.name,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const check = await eventRef.get();
    assert.equal(check.exists, true);
    assert.equal(check.data().status, "draft");

    // Verify draft never appears in public status query
    const pubSnap = await db.collection("events").where("status", "==", "published").get();
    assert.equal(pubSnap.docs.some((d) => d.id === testEventId), false);
  });

  test("Super Admin executes 'publish' transition via server service and event becomes publicly visible", async () => {
    const res = await executeLifecycleTransition({
      action: "publish",
      eventId: testEventId,
      actor: superAdminActor,
    }, db);

    assert.equal(res.success, true);
    assert.equal(res.newStatus, "published");

    const snap = await db.collection("events").doc(testEventId).get();
    const data = snap.data();
    assert.equal(data.status, "published");
    assert(data.publishedAt !== undefined, "publishedAt must be recorded");

    const pubSnap = await db.collection("events").where("status", "==", "published").get();
    assert.equal(pubSnap.docs.some((d) => d.id === testEventId), true);
  });

  test("Reject duplicate publish with StateTransitionError (409)", async () => {
    await assert.rejects(
      async () => {
        await executeLifecycleTransition({
          action: "publish",
          eventId: testEventId,
          actor: superAdminActor,
        }, db);
      },
      (err) => {
        assert(err instanceof StateTransitionError);
        assert.equal(err.statusCode, 409);
        return true;
      }
    );
  });

  test("Super Admin executes 'unpublish' transition and event is removed from public visibility", async () => {
    const res = await executeLifecycleTransition({
      action: "unpublish",
      eventId: testEventId,
      actor: superAdminActor,
    }, db);

    assert.equal(res.success, true);
    assert.equal(res.newStatus, "draft");

    const snap = await db.collection("events").doc(testEventId).get();
    assert.equal(snap.data().status, "draft");

    const pubSnap = await db.collection("events").where("status", "==", "published").get();
    assert.equal(pubSnap.docs.some((d) => d.id === testEventId), false);
  });

  test("Super Admin executes 'archive' transition and event moves to public archive", async () => {
    const res = await executeLifecycleTransition({
      action: "archive",
      eventId: testEventId,
      actor: superAdminActor,
    }, db);

    assert.equal(res.success, true);
    assert.equal(res.newStatus, "archived");

    const snap = await db.collection("events").doc(testEventId).get();
    const data = snap.data();
    assert.equal(data.status, "archived");
    assert(data.archivedAt !== undefined, "archivedAt must be recorded");

    const archSnap = await db.collection("events").where("status", "==", "archived").get();
    assert.equal(archSnap.docs.some((d) => d.id === testEventId), true);
    const pubSnap = await db.collection("events").where("status", "==", "published").get();
    assert.equal(pubSnap.docs.some((d) => d.id === testEventId), false);
  });

  test("Verifies activity logs were generated in /activity_logs", async () => {
    const logsSnap = await db
      .collection("activity_logs")
      .where("targetEntityId", "==", testEventId)
      .get();

    assert(logsSnap.size >= 3, `Expected at least 3 audit logs for lifecycle actions, found ${logsSnap.size}`);
    const actionTypes = logsSnap.docs.map((d) => d.data().actionType);
    assert(actionTypes.includes("EVENT_PUBLISH"));
    assert(actionTypes.includes("EVENT_UNPUBLISH"));
    assert(actionTypes.includes("EVENT_ARCHIVE"));
  });

  test("Worker Event Deletion: Rejects non-super_admin role with LifecycleError (403)", async () => {
    const leadActor = {
      uid: "lead-ai",
      email: "lead@dscvitb.com",
      name: "Lead",
      role: "team_lead",
      leadDomain: "AI & Data Science",
    };

    await assert.rejects(
      async () => {
        await executeWorkerEventDeletion({
          projectId: "dscvitb-ac7bf",
          firestoreAccessToken: firestoreToken,
          user: leadActor,
          eventId: testEventId,
        });
      },
      (err) => {
        assert(err instanceof LifecycleError);
        assert.equal(err.statusCode, 403);
        assert(err.message.includes("Super Admin"));
        return true;
      }
    );
  });

  test("Worker Event Deletion: Super Admin permanently deletes event and logs audit trail", async () => {
    const deleteRes = await executeWorkerEventDeletion({
      projectId: "dscvitb-ac7bf",
      firestoreAccessToken: firestoreToken,
      user: superAdminActor,
      eventId: testEventId,
    });

    assert.equal(deleteRes.success, true);
    assert.equal(deleteRes.deletedEventId, testEventId);

    // Verify document was removed from Firestore
    const checkDoc = await db.collection("events").doc(testEventId).get();
    assert.equal(checkDoc.exists, false);

    // Verify activity log was recorded
    const deleteLogs = await db
      .collection("activity_logs")
      .where("targetEntityId", "==", testEventId)
      .where("actionType", "==", "EVENT_DELETE")
      .get();
    assert.equal(deleteLogs.size, 1);
  });
});
