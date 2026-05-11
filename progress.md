# Progress Log

_Append-only session log. Newest entry on top._

---

## 2026-05-04 — Phase 7 complete (Polish) — full plan delivered
- Added [src/middlewares/requestLogger.ts](src/middlewares/requestLogger.ts) (mounted first in `app.ts`). Boot sanity: `[INFO] GET /health 200 0.6ms`, `[WARN] GET /users/me 401 1.3ms`.
- Rewrote [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) for the post-API_LIST state: all 7 controllers, all 6 services, full schema (User+RevokedToken+Band+BandMember+Event+Message), WS section, multer policy, and Tsoa+multer ordering caveat.
- `tsc --noEmit` clean. Server boots, all middlewares wire, request logger emits one line per request with correct severity.

**Cumulative smoke total**: 77 checks across phases (12 auth/user from manual + 18 bands + 16 events + 19 chat + 12 attachments). Helper scripts persist under [scripts/](scripts/) for future re-validation.

**Plan complete.** All 7 phases of [task_plan.md](task_plan.md) are marked done; out-of-scope items (tests, CI, Docker, structured logging, S3, Postgres) listed in PROJECT_OVERVIEW TODO section.

---

## 2026-05-04 — Phase 6 complete (Attachments)
**Layer files**
- DTO: [src/dtos/attachment.dto.ts](src/dtos/attachment.dto.ts) — `AttachmentResponse { url }`.
- Multer: [src/middlewares/uploads.ts](src/middlewares/uploads.ts) — `imageUpload` (memoryStorage, `fileFilter` accepting `image/*`, `limits.fileSize: 10MB`), `fileUpload` (PDF only, 20MB).
- Service: [src/services/AttachmentService.ts](src/services/AttachmentService.ts) — writes `req.file.buffer` to `uploads/{images,files}/<uuid>.<ext>`; mime → extension map with original-name fallback. `BadRequestError` on missing file.
- Controller: [src/controllers/AttachmentController.ts](src/controllers/AttachmentController.ts) — Tsoa `@Route('attachments')` + class `@Security('jwt')`. Returns absolute URL using `req.protocol + req.get('host')` (respects `x-forwarded-proto`).
- App wiring: [src/app.ts](src/app.ts) — `express.static('/static/uploads', uploads/)`; multer middlewares **mounted before `RegisterRoutes(app)`** at exact paths so `req.file` is populated before Tsoa's handler.
- Error handler: maps `MulterError` (`LIMIT_FILE_SIZE` → 413, others → 400).
- `.gitignore`: added `uploads/`.

**Auth**: All upload endpoints JWT-gated via class-level `@Security('jwt')`.

**Limits**:
- Images: any `image/*` mime, max **10MB**.
- Files: `application/pdf` only, max **20MB**.

**Smoke** ([scripts/smoke-attachments.ts](scripts/smoke-attachments.ts)): 12/12 — image upload 201 + URL shape + roundtrip GET matches bytes, mime mismatch 400 (image→/files, pdf→/images), missing file 400, oversize 413 (image>10MB, pdf>20MB), no-auth 401, invalid-token 401.

**Next**: Phase 7 — Polish (request logging, README/PROJECT_OVERVIEW update). Phase 0–6 collectively implement every endpoint in API_LIST.md.

---

## 2026-05-04 — Phase 5 complete (Chat HTTP + WebSocket)
**Schema**: `Message { id cuid, bandId, senderId, text, createdAt }` w/ `@@index([bandId, createdAt])`. `User.messages` and `Band.messages` back-relations added. Migration `20260503160858_message`.

**Layer files**
- DTO: [src/dtos/message.dto.ts](src/dtos/message.dto.ts) — `MessageResponse`, `MessageListResponse { messages, nextCursor }`, `SendMessageRequest`.
- Repo: [src/repositories/MessageRepository.ts](src/repositories/MessageRepository.ts) — `take=limit+1` trick for accurate `nextCursor` (null at end), Prisma `cursor + skip:1` for after-cursor pagination, ordered `createdAt desc, id desc`.
- Hub: [src/ws/chatHub.ts](src/ws/chatHub.ts) — Node `EventEmitter` keyed by bandId. `setMaxListeners(0)`.
- Service: [src/services/MessageService.ts](src/services/MessageService.ts) — member-gated; `send` persists then publishes to chatHub; default limit 50, clamp 1..200.
- HTTP controller: [src/controllers/MessageController.ts](src/controllers/MessageController.ts).
- WS server: [src/ws/chatServer.ts](src/ws/chatServer.ts) — `noServer:true` + listen on `httpServer.upgrade`. Path regex `^/bands/([^/]+)/chat/?$`. Auth via `?token=` (W1). Membership-asserted before `wss.handleUpgrade`. On connection, subscribes the socket to chatHub for that bandId; cleanup on `close`. Pre-upgrade rejections write raw HTTP status (`401`/`403`/`404`/`500`) and destroy the duplex.
- [src/server.ts](src/server.ts): now explicitly creates `http.Server`, attaches WS, then listens.

**Decisions implemented (W1–W3)**
- W1: token in query param.
- W2: echo to all band members (sender included).
- W3: HTTP POST also broadcasts via the same pubsub.

**Smoke** ([scripts/smoke-chat.ts](scripts/smoke-chat.ts)): 19/19 pass — HTTP send/list, non-member 403, cursor pagination (page1=3 newest, page2=3 older, end nextCursor=null), WS open for member, WS rejected for non-member (403), no-token (401), HTTP-sent broadcast reaches both Alice and Bob's WS, event shape `{ type:"message", data:{...} }`.

**TS gotcha resolved**: Node's `'upgrade'` socket arg is typed `Duplex` (from `'stream'`), not `net.Socket`. Initial typecheck failure fixed by switching the type.

**Next**: Phase 6 — Attachments.

---

## 2026-05-04 — Phase 4 complete (Events + Setlist)
**Schema**: added `Event { id cuid, bandId, title, date String, type String, description?, setlist Json default '[]', createdAt, updatedAt }` w/ `@@index([bandId, date])`. `Band.events` back-relation added. Migration `20260503160012_event` applied.

**Layer files**
- DTO: [src/dtos/event.dto.ts](src/dtos/event.dto.ts) — `EventType` literal union (`'practice'|'performance'|'other'`), `SetlistItem` (response/persisted shape — id required), `SetlistItemRequest` (id optional), and Create/Update event requests.
- Repo: [src/repositories/EventRepository.ts](src/repositories/EventRepository.ts) — ISO-date range filter (`gte`/`lte` on String column; ISO `YYYY-MM-DD` sorts lexicographically).
- Service: [src/services/EventService.ts](src/services/EventService.ts) — member-gated via `BandMemberService.assertMember`. `normalizeSetlist` preserves incoming `id`s and mints `crypto.randomUUID()` only for new entries (per question (b)).
- Controller: [src/controllers/EventController.ts](src/controllers/EventController.ts) — class-level `@Security('jwt')`.

**Smoke** ([scripts/smoke-events.ts](scripts/smoke-events.ts)): 16/16 pass — non-member 403, create with auto-IDs, list, range in/out, get/patch/delete, setlist ID preserved across PATCH (item0 same id), new item gets fresh id, invalid `type` → 422 (Tsoa), deleted event → 404.

**Next**: Phase 5 — Chat (HTTP + WebSocket).

---

## 2026-05-04 — Phase 3 complete (Band + BandMember)
**Schema**: added `Band` and `BandMember` (composite PK `(bandId, userId)`, `role` default `member`, `instrument?`). Migration `20260503155204_band` applied. `User.bandMemberships` back-relation added.

**Layer files**
- DTOs: [src/dtos/band.dto.ts](src/dtos/band.dto.ts), [src/dtos/bandMember.dto.ts](src/dtos/bandMember.dto.ts) (`BandMemberRole = 'owner' | 'member'`).
- Repos: [src/repositories/BandRepository.ts](src/repositories/BandRepository.ts) (`createWithOwner` uses `prisma.$transaction`), [src/repositories/BandMemberRepository.ts](src/repositories/BandMemberRepository.ts) (incl. `countOwners`). Added `findByEmail` back to [src/repositories/UserRepository.ts](src/repositories/UserRepository.ts).
- Services: [src/services/BandMemberService.ts](src/services/BandMemberService.ts) — owns `assertMember`/`assertOwner` plus invite/update/remove with last-owner guard. [src/services/BandService.ts](src/services/BandService.ts) composes member-service for auth.
- Controllers: [src/controllers/BandController.ts](src/controllers/BandController.ts), [src/controllers/BandMemberController.ts](src/controllers/BandMemberController.ts).

**Authorization rules implemented**
- Read band/members: any band member (`assertMember` → 403 otherwise).
- Mutate band (`PATCH`/`DELETE`): owner only (`assertOwner` → 403 otherwise).
- Invite: owner only. Missing email → 404. Already-member → 409.
- Update member: owners can change anyone's role/instrument; self can change own instrument only (role attempt → 403). Demoting last owner → 409.
- Remove member: owner can kick anyone; any member can self-leave; removing the last owner → 409.

**Smoke** ([scripts/smoke-bands.ts](scripts/smoke-bands.ts)): 18/18 pass covering each rule above plus delete-and-verify.

**Gotcha**: `prisma migrate dev` initially failed with `EPERM` on the query-engine DLL because ts-node-dev child processes from the earlier dev session were still running. Saved as memory feedback (`ts-node-dev child processes survive TaskStop`). Resolved by killing node.exe and re-running `prisma generate`.

**Next**: Phase 4 — Events (+ Setlist).

---

## 2026-05-04 — Phase 0 + 1 + 2 complete (Auth + User profile)
**Done**
- Deps: `google-auth-library`, `jsonwebtoken`, `multer`, `ws` (+ `@types/*`) installed.
- Env: `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `JWT_EXPIRES_IN` added (`.env` populated with dev placeholders, `.env.example` updated).
- Errors: `src/errors/HttpError.ts` (base + 5 concrete classes); `errorHandler.ts` now dispatches on `HttpError.statusCode`.
- Schema: rewrote `prisma/schema.prisma` — `User` with `id String cuid`, `googleSub @unique`, `profileImageUrl?`, `instrument?`, `updatedAt`; new `RevokedToken { jti @id, userId, expiresAt, revokedAt }`. Old `Int`-PK migration deleted; fresh `migrations/20260503153828_init/`.
- Layer files: `dtos/auth.dto.ts`, `dtos/user.dto.ts`, `repositories/UserRepository.ts` (rewrite), `repositories/RevokedTokenRepository.ts`, `services/AuthService.ts`, `services/UserService.ts` (rewrite), `middlewares/auth.ts` (`expressAuthentication`), `controllers/AuthController.ts`, `controllers/UserController.ts` (rewrite to /me-only).
- Type augmentation: `src/types/express.d.ts` adds `Request.user?: RequestUser`.
- `tsoa.json`: added `securityDefinitions.jwt` and `authenticationModule: src/middlewares/auth.ts`. Routes regenerated.
- Typecheck clean (`tsc --noEmit`).

**Smoke results (server up, real HTTP)**
| Case | Result |
|---|---|
| `GET /health` | 200 |
| `GET /docs` | 200 (Swagger UI) |
| `GET /users/me` no token | 401 |
| `GET /auth/me` no token | 401 |
| `POST /auth/google` empty body | 422 (Tsoa validation) |
| `POST /auth/google` bogus token | 401 |
| `GET /users/me` valid JWT | 200 + profile |
| `GET /auth/me` valid JWT | 200 |
| `PATCH /users/me` valid JWT | 200 + updated fields |
| `POST /auth/logout` valid JWT | 204 |
| `GET /users/me` re-using revoked token | 401 "Token revoked" |

**Helper added**: `scripts/smoke-auth.ts` mints a real JWT against the dev DB for manual testing; will reuse in later phases.

**Note for future**: `POST /auth/google` integration requires a real `GOOGLE_CLIENT_ID` and a Google ID token from the mobile client. Bypassed today by signing JWTs directly; worth re-validating once the mobile app or a Google Sign-In playground token is available.

**Next**: Phase 3 — Band + BandMember domain.

---

## 2026-05-04 — Planning kickoff
- Read [docs/api/API_LIST.md](docs/api/API_LIST.md) and current skeleton ([package.json](package.json), [tsoa.json](tsoa.json), [prisma/schema.prisma](prisma/schema.prisma), all of `src/`, [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md)).
- Captured findings in [findings.md](findings.md): existing layer/skeleton, gap list vs. API_LIST, 7 decision points (ID format, JWT/revocation, setlist storage, invite UX, attachment storage, WS lib, etc.).
- Drafted 8-phase plan in [task_plan.md](task_plan.md) — Foundation → Auth → User → Band/Member → Events → Chat (incl. WS) → Attachments → Polish.
- Awaiting user confirmation on D1–D6 cross-cutting decisions before starting Phase 0/1.
- No code changes yet.
