#!/usr/bin/env node
/**
 * DSC VIT Bhopal — Trusted Server-Side Event Lifecycle Manager (Admin CLI)
 *
 * Utilizes the authoritative server lifecycle service in `server/event-lifecycle-service.mjs`.
 *
 * USAGE:
 *   node scripts/event-lifecycle.mjs --action=publish --eventId=<slug>
 *   node scripts/event-lifecycle.mjs --action=unpublish --eventId=<slug>
 *   node scripts/event-lifecycle.mjs --action=archive --eventId=<slug>
 *   node scripts/event-lifecycle.mjs --action=validate --eventId=<slug>
 */

import "dotenv/config";
import {
  getAdminDb,
  validateEventForPublish,
  executeLifecycleTransition,
} from "../server/event-lifecycle-service.mjs";

const args = process.argv.slice(2);
let action = "validate";
let eventId = null;

for (const arg of args) {
  if (arg.startsWith("--action=")) {
    action = arg.split("=")[1].trim().toLowerCase();
  } else if (arg.startsWith("--eventId=")) {
    eventId = arg.split("=")[1].trim();
  }
}

console.log("\n=======================================================");
console.log("  DSC VIT Bhopal — Trusted Event Lifecycle Manager (CLI)");
console.log("=======================================================\n");

if (!eventId) {
  console.error("❌ ERROR: Missing required --eventId parameter.");
  console.log("   Usage: node scripts/event-lifecycle.mjs --action=[publish|unpublish|archive|validate] --eventId=<id>\n");
  process.exit(1);
}

const db = getAdminDb();

async function runCli() {
  const eventRef = db.collection("events").doc(eventId);
  const snap = await eventRef.get();

  if (!snap.exists) {
    console.error(`❌ ERROR: Event document "/events/${eventId}" does not exist in Firestore.`);
    process.exit(1);
  }

  const eventData = snap.data();
  console.log(`📄 Found Event: "${eventData.title}" (Status: ${eventData.status || "draft"})`);

  if (action === "validate") {
    console.log("\n🔍 Running Authoritative Publishing Validation Checks...");
    const check = validateEventForPublish(eventData);
    if (check.valid) {
      console.log("✅ ALL VALIDATION CHECKS PASSED: Event is fully eligible for publication.");
      process.exit(0);
    } else {
      console.log("❌ VALIDATION ISSUES DETECTED:");
      check.errors.forEach((e) => console.log(`   - ${e}`));
      process.exit(1);
    }
  }

  // Trusted Super Admin Actor for CLI administrative execution
  const cliActor = {
    uid: "cli-super-admin",
    email: process.env.SUPER_ADMIN_BOOTSTRAP_EMAIL || "president@dscvitb.com",
    name: "Super Admin CLI",
    role: "super_admin",
  };

  try {
    const result = await executeLifecycleTransition({ action, eventId, actor: cliActor }, db);
    console.log(`\n✅ SUCCESS: ${result.message}\n`);
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ ERROR (${err.name}): ${err.message}\n`);
    if (err.details && Array.isArray(err.details)) {
      err.details.forEach((d) => console.error(`   - ${d}`));
    }
    process.exit(1);
  }
}

runCli().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
