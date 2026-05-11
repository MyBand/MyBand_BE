# Findings

## Current Skeleton (already in place)

### Stack
- Node + TypeScript 5 (`strict`, `experimentalDecorators`)
- Express 5, Tsoa 6 (decorator → routes + swagger.json), swagger-ui-express
- Prisma 6.19 + `@prisma/adapter-better-sqlite3` (SQLite at `prisma/dev.db`)
- `dotenv`, simple console logger
- Dev: `ts-node-dev`. No test framework yet.

### Layer rule (from PROJECT_OVERVIEW.md)
**Controller → Service → Repository → Prisma**, single direction.
Only `repositories/*` may import `@prisma/client`. Controllers must not call `res.status` directly (Tsoa flow).

### What's already implemented
- [src/app.ts](src/app.ts) — Express assembly: json/urlencoded, `/health`, `/docs`, RegisterRoutes, error handlers.
- [src/server.ts](src/server.ts) — `app.listen(env.PORT)`.
- [src/utils/env.ts](src/utils/env.ts) — `DATABASE_URL`, `PORT`. Required-var guard.
- [src/utils/prisma.ts](src/utils/prisma.ts) — `resolveSqliteUrl` normalizes `file:./xxx` → absolute path under `prisma/`. Do not break this.
- [src/utils/logger.ts](src/utils/logger.ts) — console wrapper.
- [src/middlewares/errorHandler.ts](src/middlewares/errorHandler.ts) — maps `ValidateError`(422), `NotFoundError`(404), `ConflictError`(409), default 500.
- Sample User CRUD: [dto](src/dtos/user.dto.ts) / [repo](src/repositories/UserRepository.ts) / [service](src/services/UserService.ts) / [controller](src/controllers/UserController.ts).

### Existing Prisma schema ([prisma/schema.prisma](prisma/schema.prisma))
```
User { id Int @id autoincrement, email String @unique, name String, createdAt DateTime }
```
**Insufficient** for API_LIST — missing `profileImageUrl`, `instrument`, Google OAuth identifier, plus all other domains (Band, BandMember, Event, Setlist, Message, Attachment).

## API_LIST.md — required surface

| Domain | Endpoints | Notes |
|---|---|---|
| Auth | `POST /auth/google`, `POST /auth/logout`, `GET /auth/me` | Google ID token → server JWT |
| User | `GET /users/me`, `PATCH /users/me` | Profile incl. `instrument`, `profileImageUrl` |
| Band | `GET/POST /bands`, `GET/PATCH/DELETE /bands/:bandId` | `memberCount` in list response |
| BandMember | `GET/POST /bands/:bandId/members`, `PATCH/DELETE /bands/:bandId/members/:userId` | Invite by email + instrument |
| Events | `GET/POST /bands/:bandId/events`, `GET/PATCH/DELETE /bands/:bandId/events/:eventId` | Date range query, embedded `setlist[]`, `type ∈ {practice, performance, other}` |
| Chat | `GET/POST /bands/:bandId/messages` (cursor pagination) + `WS /bands/:bandId/chat` | WebSocket realtime |
| Attachment | `POST /attachments/images`, `POST /attachments/files` | multipart/form-data → returns CDN URL |

Implementation priority defined in API_LIST: Auth → Band/Member → Events → Chat → Attachment → User profile.

## Risks & Decision Points

### 1. ID format mismatch
API_LIST examples use **string IDs** (`user_001`, `b1`, `msg_001`, `e1`, `s1`). Current schema uses `Int autoincrement`. Options:
- **(A) Switch all PKs to `String @default(cuid())`** — matches doc, future-friendly for DB swap. Requires dropping/recreating User table.
- **(B) Keep Int, accept different doc** — simpler, but spec drifts.
- **(C) Keep Int, serialize to string in DTO** — leaks impl mismatch.
Recommend **(A)**, applied at the start before tables are populated.

### 2. Google OAuth verification
Needs `google-auth-library` (verify ID token against Google's JWKs) + `jsonwebtoken` (sign server JWT). Both new deps. Env additions: `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `JWT_EXPIRES_IN`.

### 3. Tsoa auth integration
Tsoa requires an `expressAuthentication(request, securityName, scopes)` function exported from a path it can find. Controllers then mark routes with `@Security('jwt')`. Need to wire this and re-run `npm run tsoa` to embed it in `routes.ts`.

### 4. Logout semantics
"Server-side token invalidation" → either short-lived JWT + a small revoked-jti table, or move to DB-backed sessions. Cheapest correct option: add `RevokedToken { jti, expiresAt }` and check on each request.

### 5. WebSocket on Tsoa/Express
Tsoa is HTTP-only. WS needs a parallel handler (`ws` lib) attached to the same `http.Server` from `server.ts`. Needs auth (JWT in query string or `Sec-WebSocket-Protocol`) and a band-membership check on connect.

### 6. Attachments storage
API returns `https://cdn.myband.app/...`. No infra defined. For local dev, simplest: write to `uploads/` and serve under `/static/...`. Production CDN is out of scope until infra spec exists.

### 7. Setlist embedding
API returns events with embedded `setlist[]`. Two viable models:
- **Setlist as separate table** with `eventId` FK + `order` field — clean, easy to mutate per-song.
- **Setlist as JSON column on Event** — fits SQLite well, simpler PATCH semantics. Recommended for v1.

### 8. Member invite UX
`POST /bands/:bandId/members { email, instrument }` — what if invitee has no account yet? Two answers:
- **Reject with 404** (require prior signup) — simpler.
- **Create pending invite row** — proper UX, more code.
Recommend **reject** for v1 and revisit.

## External References
- Tsoa auth pattern: <https://tsoa-community.github.io/docs/authentication.html>
- Google ID token verification: `google-auth-library` `OAuth2Client.verifyIdToken`
- `ws` lib for plain WebSocket on Express's http.Server.
