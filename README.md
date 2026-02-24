# COLONUS

Frontend-first scaffold for a tenant/landlord platform with local-first state and sync-ready mutations.

## Structure

- `apps/web`: Next.js app (dashboard + forms)
- `packages/shared`: TypeScript schemas shared with future backend
- `packages/sync`: Outbox queue helpers and placeholder sync processor

## Local-first flow

1. UI action updates Zustand state.
2. Persisted state is saved in local storage (`COLONUS_*`).
3. Mutation is appended to outbox queue.
4. Sync processor can replay outbox later to Keystone.

## Start

Install `pnpm` first, then:

```bash
pnpm install
pnpm dev
```

Backend API (Keystone + custom Express routes):

```bash
pnpm dev:api
```

Run both services together:

```bash
pnpm dev:all
```

Run both services and force a fresh API DB seed:

```bash
pnpm dev:all -- --reseed
```

## Vercel Deployment (Web)

Deploy only `apps/web` to Vercel:

1. Create a Vercel project from this repo.
2. Set **Root Directory** to `apps/web`.
3. Add environment variable:
   - `NEXT_PUBLIC_API_BASE_URL=https://api.colonus.lat` (replace with your API URL)
4. Add domains in Vercel:
   - `app.colonus.lat` (or `colonus.lat`) for the full app
   - `properties.colonus.lat` for public listings

`properties.colonus.lat` behavior is handled in `apps/web/middleware.ts`:
- `/` rewrites to `/available-units`
- `/<listingSlug>` rewrites to `/available-units/<listingSlug>`
- Internal Next assets and API paths are left unchanged.

## Pretend User Routes

- `/` role selector
- `/landingPage` plan and pricing overview
- `/superadmin` super admin dashboard (requires selecting role first)
- `/superadmin/add-client` guided landlord onboarding wizard
- `/superadmin/clients` searchable landlord client list and controls
- `/superadmin/clients/[landlordId]` super admin client info (properties, tenants, payments, payment periods)
- `/landlord` landlord dashboard (requires selecting role first)
- `/landlord/tenants` landlord tenant portfolio view
- `/landlord/properties` landlord property portfolio view
- `/tenant` tenant dashboard (requires selecting role first)
- `/ui-system` UI catalog page for design system validation
- `/login` generic login placeholder
- `/error` generic error route

## Login + User Provisioning (Keystone)

- Login is validated by Keystone endpoint `POST /api/auth/login`.
- Local app state is still authoritative for domain data (properties, payments, tickets, etc.).
- User records in local state now store `keystoneUserId` for mapping local users to backend users.
- Local user creation actions (`addLandlord`, `addTenant`) provision/update Keystone users first via:
  - `POST /api/auth/provision-user`
- Dev seed (`Seed Fake Data`) now seeds both:
  - local Zustand/localStorage state
  - Keystone users in batch via `POST /api/auth/provision-users`

### New First-Time Flow (Landlord + Tenant)

- When a **new landlord or tenant** is created via provisioning:
  - backend marks user as `mustChangePassword=true`
  - backend generates a first-time token
  - backend builds onboarding link: `/onboarding?token=...`
  - backend mock-sends welcome email (server log: `[MOCK_EMAIL]`)
- Landlord/Tenant login:
  - if password change is required, login redirects to `/onboarding`
- Onboarding completion endpoint:
  - `POST /api/auth/onboarding/complete`
  - body: `{ token, password, phone? }`

## .bk List

- `/landlord/index.bk` backup route that mirrors the current landlord dashboard entry

## Tiers

- `free`:
  - 10 syncs per property per day
  - Applies by property subscription (`user -> membership -> property -> tier`)
  - When limit is reached, changes still save locally but backend sync is deferred until reset or upgrade
- `unlimited`:
  - No daily sync cap
- Tier assignment:
  - Super admin can assign/change tier for each property from the dashboard
- Daily reset:
  - Sync usage resets on the next day (24h day boundary)

## Tenant Grade (Local-First MVP)

- Stored in dedicated Zustand slice: `useTenantGradesStore`
- Local storage key: `COLONUS_TENANT_GRADES_STATE`
- Versioned with shared `STORAGE_VERSION`
- Grade scope is per property + tenant (`propertyId:tenantId`)
- Current behavior:
  - Landlord can upsert grade from tenant portfolio detail view
  - Tenant can view own grade read-only in tenant dashboard
- Sync readiness:
  - Grade records include `version` (incremented on update) for future conflict handling

## Keystone Upload Endpoint (MVP)

- Backend app: `apps/api`
- Custom Express route added through Keystone server extension:
  - `POST /api/upload`
  - `POST /api/sync/backup`
- Request:
  - `multipart/form-data`
  - file field: `file`
  - text fields: `landlordId`, `propertyId`, `category`
- Cloudinary folder format:
  - `colonus/{landlordId}/{propertyId}/{category}`
- Response:
  - `{ secureUrl, publicId }`
- Upload flow (server-side):
  1. Client sends multipart request to `POST /api/upload` with `file`, `landlordId`, `propertyId`, `category`.
  2. Express route (`multer` memory storage) reads the file buffer in API server memory.
  3. API server calls Cloudinary `upload_stream` (secret stays on server).
  4. API returns Cloudinary references only: `secureUrl` and `publicId`.
- Folder structure in Cloudinary:
  - `colonus/{landlordId}/{propertyId}/{category}/...`
  - Example:
    - `colonus/abc/xyz/receipts/<generated-file>`
- Security note:
  - Cloudinary API secret is never sent to the frontend.
  - For MVP, `landlordId/propertyId/category` are accepted from request body; authorization/validation hardening is planned later.
  - Optional auth stub is available now:
    - set `REQUIRE_UPLOAD_AUTH=1`
    - pass header `x-colonus-user-id: <Keystone User id>`
  - Upload category currently validated against:
    - `receipts`, `service-payments`, `care-proof`, `refund-requests`, `tickets`, `services`, `condition`

Environment variables (`apps/api/.env.example`):

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Test with curl:

```bash
curl -F "file=@./test.jpg" \
  -F "landlordId=abc" \
  -F "propertyId=xyz" \
  -F "category=receipts" \
  http://localhost:4000/api/upload
```

Backup sync-event log (MVP):

```bash
curl -X POST http://localhost:4000/api/sync/backup \
  -H "Content-Type: application/json" \
  -d '{
    "actorId": "seed_user_landlord_1",
    "propertyId": "seed_property_1",
    "clientSessionId": "local-session-1",
    "clientStorageVersion": "8",
    "counts": { "backups": 1, "records": 42 }
  }'
```

Snapshot backup + merge (MVP):

- Upload client snapshot (state/outbox/changeLog):
  - `POST /api/sync/upload-snapshot`
- Force merge for property:
  - `POST /api/sync/merge/:propertyId`
- Download merged source-of-truth:
  - `GET /api/sync/merged/:propertyId`
- Check merged version:
  - `GET /api/sync/version/:propertyId`

Storage layout on API server:

- `apps/api/data/snapshots/{propertyId}/clients/{userId}.json` (latest by user)
- `apps/api/data/snapshots/{propertyId}/clients/{userId}/{timestamp}-{hash}.json` (history)
- `apps/api/data/snapshots/{propertyId}/merged.json`
- `apps/api/data/snapshots/{propertyId}/merged.meta.json`

Upload example:

```bash
curl -X POST http://localhost:4000/api/sync/upload-snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "property_123",
    "userId": "tenant_abc",
    "snapshot": {
      "state": { "tenants": [], "properties": [] },
      "outbox": [],
      "changeLog": []
    }
  }'
```

Frontend integration:

- Tenant upload flows call the backend endpoint and keep local-first fallback behavior.
- Optional env var for frontend API target:
  - `NEXT_PUBLIC_API_BASE_URL` (default: `http://localhost:4000`)
- Example file:
  - `apps/web/.env.local.example` (copy to `apps/web/.env.local`)

## Keystone Migration Status

- Progress tracker:
  - `docs/keystone-migration-tracker.md`
