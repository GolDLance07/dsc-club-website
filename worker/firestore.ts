/**
 * DSC VIT Bhopal — Cloudflare Worker Firestore REST API Client
 *
 * Implements:
 * - Google OAuth2 service-account JWT bearer flow using Web Crypto.
 * - Firestore REST API document reads with concurrency tracking (updateTime).
 * - Firestore REST document updates with currentDocument.updateTime preconditions.
 * - Server-side audit logging into /activity_logs.
 * - Bidirectional Firestore REST Value <-> Plain Object mapping.
 *
 * 100% compatible with Cloudflare Workers V8 isolates without Firebase Admin SDK.
 */

// In-memory token cache per OAuth scope in Worker isolate
const cachedOAuthTokens = new Map<string, { token: string; expiresAt: number }>();

function pemToBinary(pem: string): Uint8Array {
  const cleanPem = pem
    .replace(/-----BEGIN[ A-Z_-]+-----/g, "")
    .replace(/-----END[ A-Z_-]+-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\s+/g, "");

  const binary = atob(cleanPem);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Obtains a scoped OAuth2 Bearer token using a Google Service Account JWT assertion.
 */
export async function getGoogleAccessToken(
  clientEmail: string,
  privateKeyPem: string,
  scope: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const cached = cachedOAuthTokens.get(scope);
  if (cached && cached.expiresAt > now + 60) {
    return cached.token;
  }

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    scope,
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  const encodedHeader = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const keyBytes = pemToBinary(privateKeyPem);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    enc.encode(signingInput)
  );

  const encodedSignature = base64UrlEncode(new Uint8Array(signatureBuffer));
  const assertion = `${signingInput}.${encodedSignature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Failed to obtain Google OAuth2 token: HTTP ${tokenRes.status}: ${errText}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string; expires_in: number };
  const entry = {
    token: tokenData.access_token,
    expiresAt: now + (tokenData.expires_in || 3600),
  };
  cachedOAuthTokens.set(scope, entry);

  return entry.token;
}

/**
 * Obtains an OAuth2 Bearer token for Cloud Datastore (Firestore) using Google Service Account.
 */
export async function getFirestoreAccessToken(
  clientEmail: string,
  privateKeyPem: string
): Promise<string> {
  return getGoogleAccessToken(
    clientEmail,
    privateKeyPem,
    "https://www.googleapis.com/auth/datastore"
  );
}

/**
 * Obtains an OAuth2 Bearer token for Google Identity Toolkit (Firebase Auth admin REST API).
 */
export async function getIdentityToolkitAccessToken(
  clientEmail: string,
  privateKeyPem: string
): Promise<string> {
  return getGoogleAccessToken(
    clientEmail,
    privateKeyPem,
    "https://www.googleapis.com/auth/identitytoolkit"
  );
}

// =========================================================================
// Firestore REST Value Serialization
// =========================================================================

export function jsToFirestoreValue(val: unknown): Record<string, unknown> {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === "boolean") {
    return { booleanValue: val };
  }
  if (typeof val === "number") {
    if (Number.isInteger(val)) {
      return { integerValue: val.toString() };
    }
    return { doubleValue: val };
  }
  if (typeof val === "string") {
    return { stringValue: val };
  }
  if (val instanceof Date) {
    return { timestampValue: val.toISOString() };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((v) => jsToFirestoreValue(v)),
      },
    };
  }
  if (typeof val === "object") {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      fields[k] = jsToFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function firestoreValueToJs(val: Record<string, unknown>): unknown {
  if ("nullValue" in val) return null;
  if ("booleanValue" in val) return val["booleanValue"];
  if ("integerValue" in val) return parseInt(val["integerValue"] as string, 10);
  if ("doubleValue" in val) return val["doubleValue"];
  if ("stringValue" in val) return val["stringValue"];
  if ("timestampValue" in val) return val["timestampValue"];
  if ("arrayValue" in val) {
    const raw = (val["arrayValue"] as { values?: Array<Record<string, unknown>> })?.values;
    return Array.isArray(raw) ? raw.map(firestoreValueToJs) : [];
  }
  if ("mapValue" in val) {
    const fields = (val["mapValue"] as { fields?: Record<string, Record<string, unknown>> })?.fields || {};
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = firestoreValueToJs(v);
    }
    return res;
  }
  return null;
}

export function firestoreDocToJs<T>(doc: { fields?: Record<string, Record<string, unknown>> }): T {
  const res: Record<string, unknown> = {};
  if (doc.fields) {
    for (const [k, v] of Object.entries(doc.fields)) {
      res[k] = firestoreValueToJs(v);
    }
  }
  return res as T;
}

// =========================================================================
// Firestore REST API Operations
// =========================================================================

export interface FirestoreEventDoc<T = Record<string, unknown>> {
  data: T;
  updateTime: string;
  name: string;
}

/**
 * Fetches an event document from Firestore REST API.
 */
export async function getEventDocument<T = Record<string, unknown>>(
  projectId: string,
  accessToken: string,
  eventId: string
): Promise<FirestoreEventDoc<T> | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/events/${eventId}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore read failed (HTTP ${res.status}): ${errText}`);
  }

  const rawDoc = (await res.json()) as {
    name: string;
    fields?: Record<string, Record<string, unknown>>;
    updateTime: string;
  };

  return {
    data: firestoreDocToJs<T>(rawDoc),
    updateTime: rawDoc.updateTime,
    name: rawDoc.name,
  };
}

/**
 * Atomically patches an event document with concurrency protection (precondition updateTime).
 */
export async function patchEventDocument(
  projectId: string,
  accessToken: string,
  eventId: string,
  fieldsToUpdate: Record<string, unknown>,
  preconditionUpdateTime?: string
): Promise<void> {
  const params = new URLSearchParams();
  for (const field of Object.keys(fieldsToUpdate)) {
    params.append("updateMask.fieldPaths", field);
  }

  if (preconditionUpdateTime) {
    params.set("currentDocument.updateTime", preconditionUpdateTime);
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/events/${eventId}?${params.toString()}`;

  const fieldsPayload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fieldsToUpdate)) {
    fieldsPayload[k] = jsToFirestoreValue(v);
  }

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: fieldsPayload }),
  });

  if (res.status === 409 || res.status === 412) {
    throw new ConcurrencyError(
      `Concurrent modification detected on event "${eventId}". The document was updated by another process. Please refresh and retry.`,
      409
    );
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore patch failed (HTTP ${res.status}): ${errText}`);
  }
}

/**
 * Creates or updates a user role document in Firestore `/user_roles/{uid}`.
 */
export async function upsertUserRoleDocument(
  projectId: string,
  accessToken: string,
  uid: string,
  roleData: Record<string, unknown>
): Promise<void> {
  const params = new URLSearchParams();
  for (const field of Object.keys(roleData)) {
    params.append("updateMask.fieldPaths", field);
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/user_roles/${uid}?${params.toString()}`;

  const fieldsPayload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(roleData)) {
    fieldsPayload[k] = jsToFirestoreValue(v);
  }

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: fieldsPayload }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore user_roles upsert failed (HTTP ${res.status}): ${errText}`);
  }
}

/**
 * Writes an audit record into Firestore /activity_logs collection.
 */
export async function recordActivityLog(
  projectId: string,
  accessToken: string,
  log: {
    actorEmail: string;
    actorName: string;
    actorRole: string;
    actionType: string;
    targetModule: string;
    targetEntityId: string;
    details: string;
  }
): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/activity_logs`;
  const docId = `log_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  const logPayload = {
    id: docId,
    ...log,
    timestamp: new Date().toISOString(),
  };

  const fieldsPayload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(logPayload)) {
    fieldsPayload[k] = jsToFirestoreValue(v);
  }

  try {
    const res = await fetch(`${url}?documentId=${docId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: fieldsPayload }),
    });

    if (!res.ok) {
      console.warn(`[Firestore Log Warning] Could not write activity log (HTTP ${res.status})`);
    }
  } catch (err) {
    console.warn("[Firestore Log Warning] Network error writing activity log:", err);
  }
}

export class ConcurrencyError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 409) {
    super(message);
    this.name = "ConcurrencyError";
    this.statusCode = statusCode;
  }
}
