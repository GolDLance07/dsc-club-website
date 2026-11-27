#!/usr/bin/env node
/**
 * DSC VIT Bhopal — Super Admin Bootstrap Utility
 *
 * This server-side script securely mints the root Super Admin Custom Claims in Firebase Auth
 * using the Firebase Admin SDK.
 *
 * SECURITY GUARANTEES:
 * - Runs strictly in a trusted administrative Node.js environment.
 * - Never executes inside browser/client code.
 * - Replaces any client-side email-based privilege escalation.
 *
 * PREREQUISITES:
 * 1. Download serviceAccountKey.json from Firebase Console:
 *    Project Settings -> Service Accounts -> "Generate new private key"
 * 2. Set environment variable:
 *    $env:FIREBASE_SERVICE_ACCOUNT_PATH="./serviceAccountKey.json"
 * 3. Run:
 *    node scripts/bootstrap-super-admin.mjs --email=neelpandeyofficial@gmail.com
 */

import fs from "fs";
import path from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import "dotenv/config";

const args = process.argv.slice(2);
let targetEmail = "neelpandeyofficial@gmail.com";

for (const arg of args) {
  if (arg.startsWith("--email=")) {
    targetEmail = arg.split("=")[1].trim().toLowerCase();
  }
}

console.log("\n=======================================================");
console.log("  DSC VIT Bhopal — Super Admin Provisioning Tool");
console.log("=======================================================\n");

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
  console.error("❌ ERROR: Firebase Service Account Key not found at:");
  console.error(`   ${serviceAccountPath}\n`);
  console.log("📋 How to obtain your Service Account Key:");
  console.log("   1. Open the Firebase Console (https://console.firebase.google.com).");
  console.log("   2. Go to Project Settings -> Service Accounts.");
  console.log("   3. Click 'Generate new private key' and save it as serviceAccountKey.json");
  console.log("   4. Place serviceAccountKey.json in the project root directory (it is git-ignored).");
  console.log("   5. Re-run: node scripts/bootstrap-super-admin.mjs --email=" + targetEmail + "\n");
  process.exit(1);
}

let firebaseApp;
try {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
  firebaseApp = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id || process.env.VITE_FIREBASE_PROJECT_ID,
  });
} catch (err) {
  console.error("❌ ERROR: Failed to initialize Firebase Admin SDK:", err.message);
  process.exit(1);
}

async function bootstrapSuperAdmin() {
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);

  try {
    console.log(`🔍 Looking up user in Firebase Authentication: ${targetEmail}...`);
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(targetEmail);
      console.log(`   Found existing user with UID: ${userRecord.uid}`);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        console.log(`   User not registered yet. Creating user account for ${targetEmail}...`);
        userRecord = await auth.createUser({
          email: targetEmail,
          emailVerified: true,
          displayName: "Neel Pandey (President)",
        });
        console.log(`   Created new user with UID: ${userRecord.uid}`);
      } else {
        throw err;
      }
    }

    // 1. Assign Authoritative Custom Claims
    const claims = {
      role: "super_admin",
      leadDomain: "None",
      title: "President",
    };

    console.log("🔐 Minting cryptographic Custom Claims:", claims);
    await auth.setCustomUserClaims(userRecord.uid, claims);

    // 2. Persist canonical record in Firestore
    const userRoleDoc = {
      id: userRecord.uid,
      email: targetEmail,
      fullName: userRecord.displayName || "Neel Pandey",
      role: "super_admin",
      title: "President",
      leadDomain: "None",
      isActive: true,
      assignedBy: "SYSTEM_BOOTSTRAP",
      assignedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await db.collection("user_roles").doc(userRecord.uid).set(userRoleDoc, { merge: true });

    // 3. Log activity audit
    await db.collection("activity_logs").add({
      actorEmail: "SYSTEM_BOOTSTRAP",
      actorName: "CLI Script",
      actorRole: "super_admin",
      actionType: "SUPER_ADMIN_BOOTSTRAP",
      targetModule: "UserRole",
      targetEntityId: userRecord.uid,
      details: `Provisioned initial Super Admin role for ${targetEmail}`,
      timestamp: new Date().toISOString(),
    });

    console.log("\n✅ SUCCESS: Root Super Admin successfully provisioned!");
    console.log(`   User:   ${targetEmail}`);
    console.log(`   UID:    ${userRecord.uid}`);
    console.log(`   Role:   super_admin (Universal Access)`);
    console.log("\n💡 The user can now sign in at /admin using Google Sign-In.\n");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Fatal error during Super Admin bootstrap:", err);
    process.exit(1);
  }
}

bootstrapSuperAdmin();
