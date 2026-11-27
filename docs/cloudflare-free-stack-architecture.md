# DSC VIT Bhopal — Free Stack Architecture Guide
## Firebase Spark (Auth + Firestore) + Cloudflare (Workers + R2)

To eliminate Google Cloud billing and avoid upgrading Firebase to the paid Blaze tier, the DSC VIT Bhopal platform operates on a combined free-tier cloud architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Client                        │
│                   (React + TanStack SPA)                    │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
     Google Auth Tokens /               Lifecycle Actions /
      Client Firestore                  R2 Poster Uploads /
   (Scoped Security Rules)              Authorized Previews
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│        Firebase Spark        │ │     Cloudflare Workers      │
│   - Firebase Authentication  │ │  (JWT Verification Engine)  │
│   - Cloud Firestore Database │ │   - Super Admin Lifecycle   │
│   (Zero Blaze Requirements)  │ │   - Poster Storage Adapter  │
└──────────────▲───────────────┘ └──────────────┬──────────────┘
               │                                │
               │ OAuth2 Server-Side REST        │
               └────────────────────────────────┤
                                                ▼
                                 ┌─────────────────────────────┐
                                 │        Cloudflare R2        │
                                 │   (Private Posters Bucket)  │
                                 │   - 10GB/mo Free Storage    │
                                 │   - Zero Egress Fees        │
                                 └─────────────────────────────┘
```

---

### 1. Prerequisite Cloudflare Dashboard Setup

#### Step 1: Create the Private R2 Bucket
Run via Wrangler CLI:
```bash
npx wrangler r2 bucket create dsc-club-posters
```
*(Optionally create a development preview bucket: `npx wrangler r2 bucket create dsc-club-posters-dev`)*

> **Security Guarantee**: Do **not** enable the public `r2.dev` bucket URL in Cloudflare settings. The bucket remains private. All reads are mediated by the Cloudflare Worker, which enforces published-status verification and draft domain-isolation.

#### Step 2: Configure Worker Secrets
The Worker requires service account credentials to read/patch Firestore and write audit logs via the Google Datastore OAuth2 REST API.

From your Firebase `serviceAccountKey.json`:
1. **Client Email**:
   ```bash
   npx wrangler secret put FIREBASE_CLIENT_EMAIL
   # Enter the "client_email" value (e.g. firebase-adminsdk-xxx@dscvitb-ac7bf.iam.gserviceaccount.com)
   ```
2. **Private Key**:
   ```bash
   npx wrangler secret put FIREBASE_PRIVATE_KEY
   # Paste the full "private_key" string including -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----
   ```

#### Step 3: Deploy the Worker (When Approved)
```bash
npx wrangler deploy
```
Wrangler will output the deployed Worker URL (e.g. `https://dsc-event-lifecycle-worker.<your-subdomain>.workers.dev`).

#### Step 4: Configure Frontend Client
Set the public Worker URL in your production environment:
```env
VITE_WORKER_API_URL="https://dsc-event-lifecycle-worker.<your-subdomain>.workers.dev"
```

---

### 2. Local Development Without Deploying

During local development (`npm run dev`), the Vite dev server provides native local emulation via `server/vite-lifecycle-plugin.mjs`:
- Intercepts `/api/events/lifecycle`
- Intercepts `/api/events/:eventId/posters`
- Intercepts `/api/posters/:eventId/:posterFile`
- Verifies Firebase Auth tokens locally
- Stores posters in local development memory
- Requires no Cloudflare dashboard setup or remote deployment for daily local frontend work
