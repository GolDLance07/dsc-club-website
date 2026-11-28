/**
 * DSC VIT Bhopal — Cloudflare Worker Firebase Authentication Verifier
 *
 * Cryptographically verifies Firebase ID tokens using the standard Web Crypto API:
 * - Fetches & caches Google public JWKs from https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com
 * - Validates RS256 signature
 * - Validates issuer: https://securetoken.google.com/{projectId}
 * - Validates audience: {projectId}
 * - Validates expiration (exp) and issued-at (iat)
 * - Extracts authenticated claims: uid, email, role, leadDomain
 *
 * Runs natively in Cloudflare Workers V8 isolates without Node.js dependencies.
 */

export interface VerifiedUser {
  uid: string;
  email: string;
  name: string;
  role: "super_admin" | "faculty_coordinator" | "team_lead" | "member";
  leadDomain: string;
}

export interface GoogleJwks {
  keys: Array<{
    kty: string;
    alg: string;
    use: string;
    kid: string;
    n: string;
    e: string;
  }>;
}

// In-memory JWKS cache in Worker isolate
let cachedJwks: { keys: GoogleJwks["keys"]; expiresAt: number } | null = null;

async function getGooglePublicKeys(): Promise<GoogleJwks["keys"]> {
  const now = Date.now();
  if (cachedJwks && cachedJwks.expiresAt > now) {
    return cachedJwks.keys;
  }

  const res = await fetch(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Google JWKS: HTTP ${res.status}`);
  }

  // Parse cache-control header
  const cacheControl = res.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = maxAgeMatch && maxAgeMatch[1] ? parseInt(maxAgeMatch[1], 10) : 3600;

  const data = (await res.json()) as GoogleJwks;
  cachedJwks = {
    keys: data.keys,
    expiresAt: now + maxAgeSeconds * 1000,
  };

  return data.keys;
}

/**
 * Base64URL decode helper for Web Crypto.
 */
function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseJwtJson<T>(str: string): T {
  const bytes = base64UrlDecode(str);
  const decoded = new TextDecoder().decode(bytes);
  return JSON.parse(decoded) as T;
}

/**
 * Authoritatively verifies a Firebase ID token.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
  projectId: string,
  customJwks?: GoogleJwks["keys"]
): Promise<VerifiedUser> {
  if (!idToken || typeof idToken !== "string") {
    throw new AuthError("Missing or invalid token.", 401);
  }

  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new AuthError("Malformed JWT token structure.", 401);
  }

  const [rawHeader, rawPayload, rawSignature] = parts;
  if (!rawHeader || !rawPayload || !rawSignature) {
    throw new AuthError("Invalid token segments.", 401);
  }

  let header: { alg?: string; kid?: string };
  let payload: {
    iss?: string;
    aud?: string;
    sub?: string;
    email?: string;
    name?: string;
    role?: string;
    leadDomain?: string;
    exp?: number;
    iat?: number;
  };

  try {
    header = parseJwtJson(rawHeader);
    payload = parseJwtJson(rawPayload);
  } catch {
    throw new AuthError("Failed to decode token segments.", 401);
  }

  // 1. Validate Header
  if (header.alg !== "RS256" || !header.kid) {
    throw new AuthError("Unsupported algorithm or missing key ID (kid).", 401);
  }

  // 2. Validate Standard Claims
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) {
    throw new AuthError("Token has expired.", 401);
  }

  if (payload.iat && payload.iat > now + 300) {
    throw new AuthError("Token issued in the future.", 401);
  }

  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  if (payload.iss !== expectedIssuer) {
    throw new AuthError(
      `Invalid token issuer. Expected "${expectedIssuer}", got "${payload.iss}".`,
      401
    );
  }

  if (payload.aud !== projectId) {
    throw new AuthError(
      `Invalid token audience. Expected "${projectId}", got "${payload.aud}".`,
      401
    );
  }

  if (!payload.sub || typeof payload.sub !== "string" || payload.sub.trim() === "") {
    throw new AuthError("Token has empty or invalid subject (sub).", 401);
  }

  // 3. Cryptographic Signature Verification via Google JWKS (or customJwks for tests)
  const jwks = customJwks || (await getGooglePublicKeys());
  const matchingKey = jwks.find((k) => k.kid === header.kid);
  if (!matchingKey) {
    throw new AuthError(`Public key with kid "${header.kid}" not found in Google JWKS.`, 401);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    matchingKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["verify"]
  );

  const signedData = new TextEncoder().encode(`${rawHeader}.${rawPayload}`);
  const signatureBytes = base64UrlDecode(rawSignature);

  const isValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signatureBytes,
    signedData
  );

  if (!isValid) {
    throw new AuthError("Invalid cryptographic signature on ID token.", 401);
  }

  // 4. Extract authoritative claims
  const allowedRoles = ["super_admin", "faculty_coordinator", "team_lead", "member"] as const;
  const role = allowedRoles.includes(payload.role as (typeof allowedRoles)[number])
    ? (payload.role as VerifiedUser["role"])
    : "member";

  return {
    uid: payload.sub,
    email: payload.email || "",
    name: payload.name || "Authenticated User",
    role,
    leadDomain: payload.leadDomain || "None",
  };
}

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}
