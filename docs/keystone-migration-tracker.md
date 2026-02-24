# Keystone Migration Tracker

Started: 2026-02-18

## Phase A: Authoritative identity + property model

- [x] Create `User` list with role/status and profile fields.
- [x] Create `Property` list with landlord relationship.
- [x] Create `Membership` list (user/property/role/status).
- [x] Create `PropertySubscription` list (property tier/status).

## Phase B: Assets + sync logs

- [x] Create `UploadedAsset` list.
- [x] Create `SyncEvent` list.
- [x] Log `upload_asset` sync event on `POST /api/upload` success.
- [x] Log `upload_asset` sync event on `POST /api/upload` error.
- [x] Persist uploaded files metadata to `UploadedAsset`.

## Phase C: Cleanup / hardening

- [ ] Enforce unique membership (`user`,`property`) at DB level.
  - current: enforced at app logic level during seed/use; DB-level Prisma index still pending.
- [x] Add initial Keystone seed (User/Property/Membership/PropertySubscription).
- [x] Add input validation for `category`.
- [x] Add light auth guard stub for upload route (`REQUIRE_UPLOAD_AUTH=1` + `x-colonus-user-id`).
- [ ] Remove redundant FE `tenant.landlordId` once membership-backed reads are in place.
- [x] Add explicit backup endpoint writing `SyncEvent` (`POST /api/sync/backup`).
