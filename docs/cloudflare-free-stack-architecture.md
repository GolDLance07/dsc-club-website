# DSC VIT Bhopal — Free Stack Architecture Guide
## Firebase Spark (Auth + Firestore) + Cloudflare Workers

To eliminate Google Cloud billing and avoid upgrading Firebase to the paid Blaze tier, the DSC VIT Bhopal platform operates on a free-tier cloud architecture:

> **Deferred Scope Note**: Event poster uploads and Cloudflare R2 media storage are currently **deferred**. Event creation, editing, lifecycle transitions (`draft`, `published`, `archived`), and deletion operate exclusively on event metadata stored in Cloud Firestore without requiring R2 buckets or poster attachments.

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Client                        │
│                   (React + TanStack SPA)                    │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
     Google Auth Tokens /               Lifecycle Actions /
      Client Firestore                    Event Deletion
   (Scoped Security Rules)             (POST / DELETE APIs)
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│        Firebase Spark        │ │     Cloudflare Workers      │
│   - Firebase Authentication  │ │  (JWT Verification Engine)  │
│   - Cloud Firestore Database │ │   - Super Admin Lifecycle   │
│   (Zero Blaze Requirements)  │ │   - Concurrency Prechecks   │
└──────────────▲───────────────┘ └──────────────┬──────────────┘
               │                                │
               │ OAuth2 Server-Side REST        │
               └────────────────────────────────┘
```

---

### 1. Prerequisite Cloudflare Dashboard Setup

#### Step 1: Configure Worker Secrets & Least-Privilege IAM
The Worker requires service account credentials to read/patch/delete Firestore documents and write audit logs via the Google Datastore OAuth2 REST API.

##### Least-Privilege IAM Permissions Verification
To enforce the principle of least privilege, the service account used by the Cloudflare Worker does **NOT** require `Editor`, `Owner`, or broad `Firebase Admin` privileges.

The Cloudflare Worker exclusively accesses the Firestore REST API for:
1. `GET /v1/projects/{projectId}/databases/(default)/documents/events/{eventId}` (Read event documents)
2. `PATCH /v1/projects/{projectId}/databases/(default)/documents/events/{eventId}` (Update event status)
3. `POST /v1/projects/{projectId}/databases/(default)/documents/activity_logs` (Create audit log entries)
4. `DELETE /v1/projects/{projectId}/databases/(default)/documents/events/{eventId}` (Permanently delete events)

**Recommended Predefined IAM Role:**
- `roles/datastore.user` (**Cloud Datastore User**)
  Grants read, write, and delete access to Datastore / Firestore Native entities without granting project administration, Cloud Storage, Cloud Functions, Compute Engine, or Billing permissions.

**Custom IAM Role (Exact Least-Privilege Minimal Set):**
If a custom IAM role is preferred, only the following 4 permissions are needed:
- `datastore.entities.get`
- `datastore.entities.create`
- `datastore.entities.update`
- `datastore.entities.delete`

##### Worker Secrets Setup
From your dedicated least-privilege service account key:
1. **Client Email**:
   ```bash
   npx wrangler secret put FIREBASE_CLIENT_EMAIL
   # Enter the "client_email" value (e.g. dsc-worker-sa@dscvitb-ac7bf.iam.gserviceaccount.com)
   ```
2. **Private Key**:
   ```bash
   npx wrangler secret put FIREBASE_PRIVATE_KEY
   # Paste the full "private_key" string including -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----
   ```

#### Step 2: Deploy the Worker (When Approved)
```bash
npx wrangler deploy
```
Wrangler will output the deployed Worker URL (e.g. `https://dsc-event-lifecycle-worker.<your-subdomain>.workers.dev`). No R2 bucket binding or R2 secrets are required.

#### Step 3: Configure Frontend Client & Cloudflare Pages Deployment
Set the public environment variables in **Vercel** (current quick-test hosting) and **Cloudflare Pages** (final frontend hosting):
```env
VITE_FIREBASE_API_KEY="..."
VITE_FIREBASE_AUTH_DOMAIN="dscvitb-ac7bf.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="dscvitb-ac7bf"
VITE_FIREBASE_MESSAGING_SENDER_ID="..."
VITE_FIREBASE_APP_ID="..."
VITE_WORKER_API_URL="https://dsc-event-lifecycle-worker.<your-subdomain>.workers.dev"
```

- **Build Command**: `npm run build`
- **Build Output Directory**: `dist`
- **SPA Deep-Link Routing**: `public/_redirects` (`/*    /index.html   200`) is automatically copied into `dist/_redirects` for Cloudflare Pages, and `vercel.json` handles rewrites on Vercel.
- **Deploying Frontend to Pages**: Connect the repository in **Cloudflare Dashboard → Workers & Pages → Create → Pages** (`npm run build` / `dist`), because root `wrangler.jsonc` targets the API Worker (`dsc-event-lifecycle-worker`) rather than Pages.
- **CORS Policy**: `wrangler.jsonc` locks `ALLOWED_ORIGIN` to `https://dscvitb.vercel.app` (no wildcard `*`). When migrating the frontend to Cloudflare Pages later, update `ALLOWED_ORIGIN` in `wrangler.jsonc` (or Cloudflare Dashboard Worker Variables) to the new Pages URL — or use a comma-separated list (e.g. `https://dscvitb.vercel.app,https://<your-pages-domain>.pages.dev`) during the transition — then re-deploy the Worker with `npx wrangler deploy`.

---

### 2. Local Development Without Deploying

During local development (`npm run dev`), the Vite dev server provides native local emulation via `server/vite-lifecycle-plugin.mjs`:
- Intercepts `/api/events/lifecycle`
- Intercepts `DELETE /api/events/:eventId`
- Verifies Firebase Auth tokens locally
- Requires no Cloudflare dashboard setup or remote deployment for daily local frontend work
