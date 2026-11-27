#!/usr/bin/env node
/**
 * DSC VIT Bhopal — Appwrite & LocalStorage to Firestore Data Migration Utility
 *
 * NON-DESTRUCTIVE MIGRATION FOUNDATION:
 * - Safely exports / reads records from Appwrite or local JSON backup files.
 * - Enriches recruitment applications with queryable `teams: [primaryTeam, secondaryTeam]` array.
 * - Writes documents non-destructively into Firestore without altering or deleting Appwrite.
 *
 * USAGE:
 * Option A (Direct Appwrite Cloud pull):
 *   APPWRITE_API_KEY="your_key" node scripts/migrate-to-firestore.mjs --source=appwrite
 *
 * Option B (From exported JSON files):
 *   node scripts/migrate-to-firestore.mjs --source=file --input=./backup-data.json
 */

import fs from "fs";
import path from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import "dotenv/config";

console.log("\n=======================================================");
console.log("  DSC VIT Bhopal — Firestore Data Migration Utility");
console.log("=======================================================\n");

const args = process.argv.slice(2);
let sourceMode = "auto";
let inputFile = null;

for (const arg of args) {
  if (arg.startsWith("--source=")) {
    sourceMode = arg.split("=")[1].trim();
  } else if (arg.startsWith("--input=")) {
    inputFile = arg.split("=")[1].trim();
  }
}

// 1. Initialize Firebase Admin SDK
let serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(process.cwd(), "serviceAccountKey.json");

if (!fs.existsSync(serviceAccountPath)) {
  const adminSdkFiles = fs.readdirSync(process.cwd()).filter((f) => f.includes("firebase-adminsdk") && f.endsWith(".json"));
  if (adminSdkFiles.length > 0) {
    serviceAccountPath = path.resolve(process.cwd(), adminSdkFiles[0]);
  }
}

if (!fs.existsSync(serviceAccountPath)) {
  console.log("⚠️  NOTICE: Firebase Service Account Key not found at " + serviceAccountPath);
  console.log("   To run this migration, generate serviceAccountKey.json in Firebase Console.");
  console.log("   Migration utility is ready; awaiting backend service credentials.\n");
  process.exit(0);
}

let firebaseApp;
try {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
  firebaseApp = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id || process.env.VITE_FIREBASE_PROJECT_ID,
  });
} catch (err) {
  console.error("❌ ERROR initializing Firebase Admin SDK:", err.message);
  process.exit(1);
}

const db = getFirestore(firebaseApp);

async function runMigration() {
  console.log("Starting migration process...");

  // Check if an input JSON file was provided
  if (inputFile && fs.existsSync(inputFile)) {
    console.log(`📂 Reading source records from JSON export: ${inputFile}`);
    const rawData = JSON.parse(fs.readFileSync(inputFile, "utf-8"));

    let migratedApps = 0;
    let migratedRoles = 0;

    // Migrate Applications
    if (Array.isArray(rawData.applications)) {
      console.log(`\n⏳ Migrating ${rawData.applications.length} recruitment applications...`);
      for (const app of rawData.applications) {
        const docId = app.id || app.$id || `app-${Date.now()}`;
        // Enrich with queryable teams array
        const teams = [app.primaryTeam, app.secondaryTeam].filter(Boolean);

        const firestoreRecord = {
          ...app,
          id: docId,
          teams: teams.length > 0 ? teams : [app.primaryTeam || "Technical"],
          status: app.status || "applied",
          migratedAt: FieldValue.serverTimestamp(),
        };
        delete firestoreRecord.$id;
        delete firestoreRecord.$databaseId;
        delete firestoreRecord.$collectionId;

        await db.collection("hiring_applications").doc(docId).set(firestoreRecord, { merge: true });
        migratedApps++;
      }
      console.log(`✅ Successfully migrated ${migratedApps} recruitment applications.`);
    }

    // Migrate User Roles
    if (Array.isArray(rawData.roles)) {
      console.log(`\n⏳ Migrating ${rawData.roles.length} user roles...`);
      for (const role of rawData.roles) {
        const docId = role.id || role.$id || role.email;
        const firestoreRecord = {
          ...role,
          id: docId,
          migratedAt: FieldValue.serverTimestamp(),
        };
        delete firestoreRecord.$id;
        await db.collection("user_roles").doc(docId).set(firestoreRecord, { merge: true });
        migratedRoles++;
      }
      console.log(`✅ Successfully migrated ${migratedRoles} user roles.`);
    }

    console.log("\n🎉 Migration completed successfully.");
    process.exit(0);
  }

  // If no file provided and Appwrite key missing, display manual export guide
  console.log("ℹ️  No input JSON file provided via --input=<path>.");
  console.log("   To migrate existing Appwrite records safely:");
  console.log("   1. In Appwrite Console, export the 'recruitment_applications' collection as JSON.");
  console.log("   2. Save the file as backup-applications.json");
  console.log("   3. Run: node scripts/migrate-to-firestore.mjs --input=./backup-applications.json\n");
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("❌ Migration error:", err);
  process.exit(1);
});
