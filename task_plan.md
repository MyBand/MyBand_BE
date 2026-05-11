# Task Plan — MyBand_BE backend implementation per `docs/api/API_LIST.md`

## Goal
Implement the REST (and WebSocket) backend that satisfies every endpoint in [docs/api/API_LIST.md](docs/api/API_LIST.md), respecting the existing Tsoa + Prisma layered skeleton.

## Scope
- **In scope:** Auth, User, Band, BandMember, Events (+ Setlist), Chat (incl. WS), Attachments. Persistent state in SQLite via Prisma. Tsoa auth integration. Local-disk file storage for attachments (dev).
- **Out of scope (until requested):** Production CDN, PostgreSQL migration, push notifications, automated tests, CI/CD, Docker, structured/observability logging, rate limiting.

## Cross-cutting Decisions (confirmed 2026-05-04)
- [x] **D1 — ID format**: `String @default(cuid())` for all PKs.
- [x] **D2 — JWT lifetime / revocation**: 7d JWT + `RevokedToken` table.
- [x] **D3 — Setlist storage**: JSON column on `Event`.
- [x] **D4 — Member invite when invitee has no account**: 404 reject.
- [x] **D5 — Attachments**: local `uploads/` + `/static/...` for dev.
- [x] **D6 — WebSocket lib**: `ws`.
- [x] **Q7 — Logout**: revoke the bearer token from the header.
- [x] **Q8 — Sample User CRUD**: dropped (replaced by `/users/me`).

## Phases

### Phase 0 — Foundation (auth-agnostic plumbing) ✅
- [x] Decisions D1–D6 confirmed.
- [x] Add deps: `google-auth-library`, `jsonwebtoken`, `multer`, `ws` (+ `@types/*`).
- [x] Extend `env.ts` with `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `JWT_EXPIRES_IN`.
- [x] Update `.env.example`.
- [x] Add `src/errors/HttpError.ts` with `BadRequest/Unauthorized/Forbidden/NotFound/Conflict`. Refactor `errorHandler.ts` to dispatch on `HttpError.statusCode`.

### Phase 1 — Auth ✅
- [x] Schema rewritten (`User` w/ `id String cuid`, `googleSub`, `profileImageUrl?`, `instrument?`, `updatedAt`; `RevokedToken { jti, userId, expiresAt, revokedAt }`). Fresh init migration applied.
- [x] `dtos/auth.dto.ts` — `GoogleLoginRequest`, `AuthUser`, `LoginResponse`.
- [x] `UserRepository` — `findById`, `findByGoogleSub`, `upsertFromGoogle`, `update`.
- [x] `RevokedTokenRepository` — `isRevoked`, `revoke`.
- [x] `AuthService` — Google ID token verify, JWT sign w/ `jti`, `verifyAccessToken` w/ revocation check, `logout`.
- [x] `middlewares/auth.ts` — Tsoa `expressAuthentication('jwt')`. `tsoa.json` updated w/ `authenticationModule` + `securityDefinitions.jwt`.
- [x] `AuthController` — `POST /auth/google`, `POST /auth/logout`, `GET /auth/me`. Type-augmentation `src/types/express.d.ts` for `req.user`.
- [x] Manual smoke (via `scripts/smoke-auth.ts`): login → /users/me 200 → PATCH 200 → logout 204 → /users/me 401 "Token revoked".

### Phase 2 — User profile ✅
- [x] `dtos/user.dto.ts` — `UserProfileResponse`, `UpdateUserProfileRequest`.
- [x] `UserService` rewritten to `getProfile`/`updateProfile`.
- [x] `UserController` exposes only `GET /users/me`, `PATCH /users/me` under class-level `@Security('jwt')`. Sample CRUD dropped.

### Phase 3 — Band + BandMember ✅
- [x] Schema added: `Band`, `BandMember { bandId, userId, role(default 'member'), instrument?, joinedAt, @@id([bandId,userId]) }`. Migration `20260503155204_band` applied.
- [x] DTOs (`band.dto`, `bandMember.dto` w/ `BandMemberRole = 'owner'|'member'`).
- [x] Repos: `BandRepository` (incl. `createWithOwner` `$transaction`), `BandMemberRepository` (incl. `countOwners`). `UserRepository.findByEmail` re-added.
- [x] Services: `BandMemberService` owns `assertMember`/`assertOwner`/`invite`/`updateMember`/`removeMember` w/ last-owner guard. `BandService` composes member-service for auth.
- [x] Controllers: `BandController` (`/bands`, `/bands/{bandId}`), `BandMemberController` (`/bands/{bandId}/members`, `/bands/{bandId}/members/{userId}`). Class-level `@Security('jwt')`.
- [x] Smoke ([scripts/smoke-bands.ts](scripts/smoke-bands.ts)): 18/18 pass — create, list, invite, missing-email-404, member-list, non-owner-403, owner-patch, self-instrument, self-role-403, last-owner-leave-409, promote, leave-after-promote, outsider-delete-403, owner-delete-204.

### Phase 4 — Events (+ Setlist) ✅
- [x] Schema: `Event { id, bandId, title, date(String), type, description?, setlist Json default '[]', createdAt, updatedAt }` w/ `@@index([bandId, date])`. Migration `20260503160012_event` applied.
- [x] DTOs: `EventType = 'practice'|'performance'|'other'`, `SetlistItem`, `SetlistItemRequest`, `Event/Create/Update`. Tsoa validates `type` literal union.
- [x] `EventRepository` w/ ISO-date range filter (`gte`/`lte` on String column — lexicographic order works for ISO dates).
- [x] `EventService` member-gated via `BandMemberService.assertMember`. `normalizeSetlist` preserves incoming `id` and mints `crypto.randomUUID()` for new items (D-question (b)).
- [x] `EventController` @Route('bands/{bandId}/events') w/ class-level `@Security('jwt')`.
- [x] Smoke ([scripts/smoke-events.ts](scripts/smoke-events.ts)): 16/16 — non-member 403, create+auto-IDs, list, range filters (in/out), get/patch/delete, setlist ID preservation across PATCH, new-item ID minted, invalid `type` 422, deleted-event 404.

### Phase 5 — Chat (HTTP + WebSocket) ✅
- [x] Schema: `Message { id cuid, bandId, senderId, text, createdAt }` w/ `@@index([bandId, createdAt])`. Migration `20260503160858_message`.
- [x] HTTP cursor pagination: `GET/POST /bands/{bandId}/messages` with `?cursor`/`?limit` (default 50, max 200). `take=limit+1` trick for accurate `nextCursor` (null when at end).
- [x] In-process pubsub: [src/ws/chatHub.ts](src/ws/chatHub.ts) (EventEmitter, topic per bandId).
- [x] WS server: [src/ws/chatServer.ts](src/ws/chatServer.ts) attached to `http.Server` via `attachChatServer`. Path regex `/bands/:bandId/chat`. Auth: `?token=...` (W1). Membership-checked at upgrade. Echo to all band sockets (W2).
- [x] HTTP POST also publishes to `chatHub` (W3) — single broadcast path for HTTP and WS sends.
- [x] `server.ts` refactored: explicit `http.createServer(app)` + `attachChatServer`.
- [x] Smoke ([scripts/smoke-chat.ts](scripts/smoke-chat.ts)): 19/19 — HTTP send/list, non-member 403, cursor pagination across 7 messages (page1/page2 contents + end nextCursor), WS open for member, WS rejected for non-member (403) + no-token (401), HTTP→WS broadcast reaches both alice and bob (echo-to-all), WS event shape `{ type:"message", data:{...} }`.

### Phase 6 — Attachments ✅
- [x] `multer` middlewares ([src/middlewares/uploads.ts](src/middlewares/uploads.ts)): memoryStorage + per-route `fileFilter` (image/* and application/pdf) + `limits.fileSize` (10MB / 20MB).
- [x] Mounted before `RegisterRoutes` in [src/app.ts](src/app.ts) so `req.file` is populated before Tsoa runs the controller. Static serving at `/static/uploads`.
- [x] AttachmentService writes buffer to disk under `uploads/{images|files}/<uuid>.<ext>`; ext from mime map with original-name fallback.
- [x] AttachmentController @Route('attachments') w/ class `@Security('jwt')`. Returns `{ url: <abs URL> }`.
- [x] errorHandler maps `MulterError` (`LIMIT_FILE_SIZE` → 413, else 400).
- [x] `.gitignore` updated for `uploads/`.
- [x] Smoke ([scripts/smoke-attachments.ts](scripts/smoke-attachments.ts)): 12/12 — image upload + roundtrip read, mime mismatch 400 (both directions), missing file 400, oversize 413 (both), no-auth and invalid-token 401.

### Phase 7 — Polish ✅
- [x] Request logging middleware ([src/middlewares/requestLogger.ts](src/middlewares/requestLogger.ts)) — one line per response (`METHOD path status durationMs`), severity by status (5xx=error, 4xx=warn, else info). Mounted first in [src/app.ts](src/app.ts).
- [x] [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) rewritten end-to-end: full stack, every domain (Auth/User/Band/Members/Events/Chat/Attachments), WS topology, layer rule with the documented `prisma.$transaction` exception in `BandRepository`, and an updated agent-handoff section (Tsoa + multer ordering, ts-node-dev/Prisma DLL gotcha, WS query-token rationale).
- [x] Smoke-test checklist captured in [progress.md](progress.md) per phase.

## Success Criteria
- Every endpoint in API_LIST.md responds per its spec (status codes + shapes).
- All endpoints except `POST /auth/google` reject missing/invalid tokens with 401.
- Layer rule unbroken: `@prisma/client` imported only in `src/repositories/`.
- `npm run dev` boots cleanly; Swagger UI at `/docs` reflects all routes.

## Open Questions for the user
1. Confirm/override decisions **D1–D6** above.
2. Should `POST /auth/logout` require the access token in the body (so it can revoke a specific token) or only revoke the bearer token in the header? (Going with bearer-header revocation unless told otherwise.)
3. Drop the existing sample `User CRUD` endpoints, or keep them temporarily for testing?
