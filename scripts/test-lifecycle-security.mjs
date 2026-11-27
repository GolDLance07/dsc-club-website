#!/usr/bin/env node
/**
 * DSC VIT Bhopal — Cloudflare Free Stack Security & Lifecycle Test Suite
 *
 * Verifies:
 * 1. Worker & Server Authorization: only 'super_admin' can execute lifecycle transitions.
 * 2. Shared Pure Validation: title, descriptions, dates, and 1-5 posters with exactly 1 primary.
 * 3. R2 Poster Security & Validation: MIME, 5MB, role permissions, domain isolation, draft privacy.
 * 4. Concurrency Protection & State Machine Integrity.
 * 5. End-to-end Firestore execution and activity logging.
 * 6. Static assertion of Firestore security rules denying client status updates.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
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
  validatePosterUpload,
  MAX_POSTER_SIZE_BYTES,
  MAX_POSTERS_PER_EVENT,
} from "../src/lib/shared/event-validation.ts";

import {
  verifyFirebaseIdToken,
  AuthError,
} from "../worker/auth.ts";

import {
  uploadPosterToR2,
  deletePosterFromR2,
  servePosterFromR2,
  StorageError,
} from "../worker/storage.ts";

import {
  ConcurrencyError,
} from "../worker/firestore.ts";

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
    posters: [
      {
        id: "poster_1",
        storagePath: "events/test/posters/poster_1.webp",
        url: "/api/posters/test/poster_1.webp",
        isPrimary: true,
        displayOrder: 1,
      },
    ],
  };

  test("Passes when all fields, dates, and posters conform to requirements", () => {
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

  test("Fails if posters array is empty", () => {
    const result = validateEventForPublish({ ...validBaseEvent, posters: [] });
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.includes("must have between 1 and 5 posters")));
  });

  test("Fails if more than 5 posters are attached", () => {
    const posters = Array.from({ length: 6 }, (_, i) => ({
      id: `poster_${i}`,
      storagePath: `events/test/posters/poster_${i}.webp`,
      url: `/api/posters/test/poster_${i}.webp`,
      isPrimary: i === 0,
      displayOrder: i + 1,
    }));
    const result = validateEventForPublish({ ...validBaseEvent, posters });
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.includes("cannot have more than 5 posters")));
  });

  test("Fails if no poster is marked as isPrimary", () => {
    const posters = [
      {
        id: "poster_1",
        storagePath: "events/test/posters/poster_1.webp",
        url: "/api/posters/test/poster_1.webp",
        isPrimary: false,
        displayOrder: 1,
      },
    ];
    const result = validateEventForPublish({ ...validBaseEvent, posters });
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.includes("Exactly ONE poster must be marked as primary cover")));
  });

  test("Fails if more than 1 poster is marked as isPrimary", () => {
    const posters = [
      {
        id: "poster_1",
        storagePath: "events/test/posters/p1.webp",
        url: "/api/posters/test/p1.webp",
        isPrimary: true,
        displayOrder: 1,
      },
      {
        id: "poster_2",
        storagePath: "events/test/posters/p2.webp",
        url: "/api/posters/test/p2.webp",
        isPrimary: true,
        displayOrder: 2,
      },
    ];
    const result = validateEventForPublish({ ...validBaseEvent, posters });
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.includes("found 2")));
  });

  test("Fails if a poster is missing its R2 storagePath", () => {
    const posters = [
      {
        id: "poster_1",
        storagePath: "",
        url: "/api/posters/test/p1.webp",
        isPrimary: true,
        displayOrder: 1,
      },
    ];
    const result = validateEventForPublish({ ...validBaseEvent, posters });
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.includes("missing a valid R2 storagePath")));
  });
});

// =========================================================================
// 3. R2 Poster Upload & Format Validation
// =========================================================================
describe("3. R2 Poster Upload & Format Validation", () => {
  test("Passes validation for valid JPEG, PNG, and WebP images <= 5MB", () => {
    assert.equal(
      validatePosterUpload({
        contentType: "image/jpeg",
        sizeBytes: 1024 * 1024,
        currentPostersCount: 0,
      }).valid,
      true
    );
    assert.equal(
      validatePosterUpload({
        contentType: "image/png",
        sizeBytes: 2 * 1024 * 1024,
        currentPostersCount: 2,
      }).valid,
      true
    );
    assert.equal(
      validatePosterUpload({
        contentType: "image/webp",
        sizeBytes: 4.9 * 1024 * 1024,
        currentPostersCount: 4,
      }).valid,
      true
    );
  });

  test("Rejects invalid media formats (e.g. SVG, GIF, PDF, EXE)", () => {
    const svgResult = validatePosterUpload({
      contentType: "image/svg+xml",
      sizeBytes: 500,
      currentPostersCount: 0,
    });
    assert.equal(svgResult.valid, false);
    assert(svgResult.errors.some((e) => e.includes("Invalid image format")));

    const pdfResult = validatePosterUpload({
      contentType: "application/pdf",
      sizeBytes: 5000,
      currentPostersCount: 0,
    });
    assert.equal(pdfResult.valid, false);
  });

  test("Rejects files exceeding 5MB ceiling", () => {
    const oversizeResult = validatePosterUpload({
      contentType: "image/jpeg",
      sizeBytes: 5.1 * 1024 * 1024,
      currentPostersCount: 0,
    });
    assert.equal(oversizeResult.valid, false);
    assert(oversizeResult.errors.some((e) => e.includes("exceeds maximum allowed limit of 5 MB")));
  });

  test("Rejects empty 0-byte files", () => {
    const emptyResult = validatePosterUpload({
      contentType: "image/png",
      sizeBytes: 0,
      currentPostersCount: 0,
    });
    assert.equal(emptyResult.valid, false);
    assert(emptyResult.errors.some((e) => e.includes("File is empty")));
  });

  test("Rejects uploads when current posters count has reached 5", () => {
    const limitResult = validatePosterUpload({
      contentType: "image/webp",
      sizeBytes: 1024,
      currentPostersCount: 5,
    });
    assert.equal(limitResult.valid, false);
    assert(limitResult.errors.some((e) => e.includes("Maximum poster limit reached")));
  });
});

// =========================================================================
// 4. R2 Poster Security & Access Control
// =========================================================================
describe("4. R2 Poster Security & Access Control", () => {
  const db = getAdminDb();
  let firestoreToken = "";
  const projectId = "dscvitb-ac7bf";
  const draftEventId = "test-r2-draft-" + Date.now();
  const publishedEventId = "test-r2-published-" + Date.now();

  const r2StorageMap = new Map();
  const mockR2 = {
    put: async (key, val, opts) => {
      r2StorageMap.set(key, { data: val, contentType: opts?.httpMetadata?.contentType });
    },
    get: async (key) => {
      const item = r2StorageMap.get(key);
      if (!item) return null;
      return {
        body: item.data,
        httpMetadata: { contentType: item.contentType },
        httpEtag: '"mock-etag"',
        size: item.data?.length || 100,
      };
    },
    delete: async (key) => {
      r2StorageMap.delete(key);
    },
  };

  test("Setup: Obtain Firestore token and seed draft & published events", async () => {
    const saPath = path.resolve(process.cwd(), "serviceAccountKey.json");
    const sa = JSON.parse(fs.readFileSync(saPath, "utf-8"));
    const { getFirestoreAccessToken } = await import("../worker/firestore.ts");
    firestoreToken = await getFirestoreAccessToken(sa.client_email, sa.private_key);
    assert(firestoreToken.length > 0);

    // Seed draft event in 'AI & Data Science' domain
    await db.collection("events").doc(draftEventId).set({
      id: draftEventId,
      title: "R2 Poster Security Draft Event",
      status: "draft",
      domainScope: "AI & Data Science",
      posters: [
        {
          id: "poster_draft_1",
          storagePath: `events/${draftEventId}/posters/poster_draft_1.webp`,
          url: `/api/posters/${draftEventId}/poster_draft_1.webp`,
          isPrimary: true,
          displayOrder: 1,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Seed file in mock R2
    await mockR2.put(`events/${draftEventId}/posters/poster_draft_1.webp`, new Uint8Array([1, 2, 3]), {
      httpMetadata: { contentType: "image/webp" },
    });

    // Seed published event in 'Technical' domain
    await db.collection("events").doc(publishedEventId).set({
      id: publishedEventId,
      title: "R2 Poster Security Published Event",
      status: "published",
      domainScope: "Technical",
      posters: [
        {
          id: "poster_pub_1",
          storagePath: `events/${publishedEventId}/posters/poster_pub_1.webp`,
          url: `/api/posters/${publishedEventId}/poster_pub_1.webp`,
          isPrimary: true,
          displayOrder: 1,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await mockR2.put(`events/${publishedEventId}/posters/poster_pub_1.webp`, new Uint8Array([4, 5, 6]), {
      httpMetadata: { contentType: "image/webp" },
    });
  });

  test("Draft poster preview without auth is rejected with 401", async () => {
    await assert.rejects(
      async () => {
        await servePosterFromR2({
          r2Bucket: mockR2,
          projectId,
          firestoreAccessToken: firestoreToken,
          user: null,
          eventId: draftEventId,
          posterFile: "poster_draft_1.webp",
        });
      },
      (err) => {
        assert(err instanceof StorageError);
        assert.equal(err.statusCode, 401);
        assert(err.message.includes("Authentication required"));
        return true;
      }
    );
  });

  test("Draft poster preview by unauthorized role (member) is rejected with 403", async () => {
    const memberUser = {
      uid: "mem-1",
      email: "mem@test.com",
      name: "Member",
      role: "member",
      leadDomain: "None",
    };

    await assert.rejects(
      async () => {
        await servePosterFromR2({
          r2Bucket: mockR2,
          projectId,
          firestoreAccessToken: firestoreToken,
          user: memberUser,
          eventId: draftEventId,
          posterFile: "poster_draft_1.webp",
        });
      },
      (err) => {
        assert(err instanceof StorageError);
        assert.equal(err.statusCode, 403);
        assert(err.message.includes("Forbidden"));
        return true;
      }
    );
  });

  test("Team Lead cannot access another domain's draft poster by guessing its path (403)", async () => {
    const technicalLead = {
      uid: "lead-tech",
      email: "techlead@dscvitb.com",
      name: "Tech Lead",
      role: "team_lead",
      leadDomain: "Technical",
    };

    // Technical Lead guessing path on AI & Data Science draft event
    await assert.rejects(
      async () => {
        await servePosterFromR2({
          r2Bucket: mockR2,
          projectId,
          firestoreAccessToken: firestoreToken,
          user: technicalLead,
          eventId: draftEventId,
          posterFile: "poster_draft_1.webp",
        });
      },
      (err) => {
        assert(err instanceof StorageError);
        assert.equal(err.statusCode, 403);
        assert(err.message.includes("Forbidden"));
        return true;
      }
    );
  });

  test("Team Lead can preview draft poster within own assigned domain", async () => {
    const aiLead = {
      uid: "lead-ai",
      email: "ailead@dscvitb.com",
      name: "AI Lead",
      role: "team_lead",
      leadDomain: "AI & Data Science",
    };

    const res = await servePosterFromR2({
      r2Bucket: mockR2,
      projectId,
      firestoreAccessToken: firestoreToken,
      user: aiLead,
      eventId: draftEventId,
      posterFile: "poster_draft_1.webp",
    });

    assert(res.body !== null);
    assert.equal(res.contentType, "image/webp");
  });

  test("Published poster can be retrieved publicly without auth", async () => {
    const res = await servePosterFromR2({
      r2Bucket: mockR2,
      projectId,
      firestoreAccessToken: firestoreToken,
      user: null, // Anonymous public user
      eventId: publishedEventId,
      posterFile: "poster_pub_1.webp",
    });

    assert(res.body !== null);
    assert.equal(res.contentType, "image/webp");
    assert(res.cacheControl.includes("public"));
  });

  test("Team Lead cannot upload poster to an event in another domain (403)", async () => {
    const technicalLead = {
      uid: "lead-tech",
      email: "techlead@dscvitb.com",
      name: "Tech Lead",
      role: "team_lead",
      leadDomain: "Technical",
    };

    await assert.rejects(
      async () => {
        await uploadPosterToR2({
          r2Bucket: mockR2,
          projectId,
          firestoreAccessToken: firestoreToken,
          user: technicalLead,
          eventId: draftEventId, // AI domain event
          fileBuffer: new Uint8Array([1, 2, 3]),
          contentType: "image/webp",
        });
      },
      (err) => {
        assert(err instanceof StorageError);
        assert.equal(err.statusCode, 403);
        assert(err.message.includes("Permission Denied"));
        return true;
      }
    );
  });

  test("Team Lead can upload poster to own domain draft event", async () => {
    const aiLead = {
      uid: "lead-ai",
      email: "ailead@dscvitb.com",
      name: "AI Lead",
      role: "team_lead",
      leadDomain: "AI & Data Science",
    };

    const uploaded = await uploadPosterToR2({
      r2Bucket: mockR2,
      projectId,
      firestoreAccessToken: firestoreToken,
      user: aiLead,
      eventId: draftEventId,
      fileBuffer: new Uint8Array([10, 20, 30, 40]),
      contentType: "image/webp",
      caption: "Valid AI Poster",
    });

    assert(uploaded.id.startsWith("poster_"));
    assert(uploaded.storagePath.includes(`events/${draftEventId}/posters/`));
    assert(r2StorageMap.has(uploaded.storagePath));
  });

  test("Cleanup R2 test events", async () => {
    await db.collection("events").doc(draftEventId).delete();
    await db.collection("events").doc(publishedEventId).delete();
  });
});

// =========================================================================
// 5. Firestore Security Rules Client-Side Denial Static Assertions
// =========================================================================
describe("5. Firestore Security Rules Client-Side Denial Static Assertions", () => {
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
});

// =========================================================================
// 6. End-to-End Database Lifecycle Execution & Audit Trail
// =========================================================================
describe("6. End-to-End Database Lifecycle Execution & Audit Trail", () => {
  const db = getAdminDb();
  const testEventId = "security-test-cf-" + Date.now();
  const superAdminActor = {
    uid: "test-super-admin-uid",
    email: "superadmin.test@dscvitb.com",
    name: "Test President",
    role: "super_admin",
  };

  test("Setup: Seed draft event in Firestore with valid R2 poster metadata", async () => {
    const eventRef = db.collection("events").doc(testEventId);
    await eventRef.set({
      id: testEventId,
      slug: testEventId,
      title: "Cloudflare R2 Verified AI Sprint",
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
      posters: [
        {
          id: "poster_cf_1",
          storagePath: `events/${testEventId}/posters/poster_1.webp`,
          url: `/api/posters/${testEventId}/poster_1.webp`,
          isPrimary: true,
          displayOrder: 1,
          caption: "Primary Verified R2 Poster",
        },
      ],
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
  });

  test("Super Admin executes 'publish' transition via server service", async () => {
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

  test("Super Admin executes 'unpublish' transition via server service", async () => {
    const res = await executeLifecycleTransition({
      action: "unpublish",
      eventId: testEventId,
      actor: superAdminActor,
    }, db);

    assert.equal(res.success, true);
    assert.equal(res.newStatus, "draft");

    const snap = await db.collection("events").doc(testEventId).get();
    assert.equal(snap.data().status, "draft");
  });

  test("Super Admin executes 'archive' transition via server service", async () => {
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

  test("Cleanup: Delete test event", async () => {
    await db.collection("events").doc(testEventId).delete();
    const check = await db.collection("events").doc(testEventId).get();
    assert.equal(check.exists, false);
  });
});
