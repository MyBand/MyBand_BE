# PROJECT OVERVIEW

> 마지막 업데이트: 2026-05-04
> 이 문서는 다른 AI 에이전트가 프로젝트를 빠르게 파악할 수 있도록 작성된 기술 문서입니다.

## 프로젝트 개요
- **앱 이름**: MyBand_BE
- **목적**: "MyBand" 애플리케이션의 백엔드 API 서버. 밴드/멤버/일정/채팅/첨부 도메인 로직을 REST + WebSocket 으로 제공.
- **현재 단계**: [docs/api/API_LIST.md](docs/api/API_LIST.md) 의 모든 엔드포인트가 구현되어 있고, 각 도메인마다 smoke 테스트 스크립트로 검증 완료. 프로덕션 배포 전 단계.
- **사용자 시나리오**: MyBand 프런트엔드(플러터 앱 등)가 Google OAuth 로 로그인 후 자체 JWT 로 REST/WS 호출.

## 기술 스택
- **런타임**: Node.js (LTS)
- **언어**: TypeScript 5.x (`strict: true`, `experimentalDecorators: true`)
- **웹 프레임워크**: Express 5.x
- **API 라우팅/스펙**: Tsoa 6.x (데코레이터 기반 컨트롤러 → `src/routes/routes.ts` + `swagger.json` 자동 생성)
- **API 문서**: `swagger-ui-express` + Tsoa 가 생성한 `swagger.json` 을 `/docs` 에 서빙
- **인증**: `google-auth-library` (Google ID Token 검증) + `jsonwebtoken` (자체 JWT 발급/검증). Tsoa `@Security('jwt')` + `expressAuthentication` 로 라우트 보호.
- **실시간**: `ws` 라이브러리. `http.Server` 의 `upgrade` 이벤트에서 직접 인증 + 멤버십 체크 후 `noServer` 모드로 핸드셰이크.
- **파일 업로드**: `multer` (memoryStorage) + 디스크 저장. `/static/uploads` 에 정적 서빙.
- **ORM**: Prisma 6.19 (`@prisma/client`) + driver adapter `@prisma/adapter-better-sqlite3`
- **데이터베이스**: SQLite (`prisma/dev.db`) via `better-sqlite3`
- **런타임 유틸**: `dotenv`
- **개발 도구**: `ts-node-dev` (핫리로드), `prisma` CLI

## 프로젝트 구조
```
MyBand_BE/
├── prisma/
│   ├── schema.prisma             # User, RevokedToken, Band, BandMember, Event, Message
│   ├── migrations/               # init / band / event / message
│   └── dev.db                    # 개발용 SQLite (gitignore)
├── src/
│   ├── controllers/              # Tsoa 컨트롤러 (스캔 경로)
│   │   ├── AuthController.ts          # /auth/google, /auth/logout, /auth/me
│   │   ├── UserController.ts          # /users/me
│   │   ├── BandController.ts          # /bands, /bands/{id}
│   │   ├── BandMemberController.ts    # /bands/{id}/members[/userId]
│   │   ├── EventController.ts         # /bands/{id}/events[/eventId]
│   │   ├── MessageController.ts       # /bands/{id}/messages
│   │   └── AttachmentController.ts    # /attachments/{images,files}
│   ├── services/
│   │   ├── AuthService.ts             # Google ID Token 검증, JWT 발급/검증, 토큰 폐기
│   │   ├── UserService.ts             # /users/me 프로필 조회/수정
│   │   ├── BandService.ts             # 밴드 CRUD (멤버 권한은 BandMemberService 위임)
│   │   ├── BandMemberService.ts       # 멤버 권한 헬퍼 (assertMember/assertOwner) + 초대/수정/탈퇴/추방
│   │   ├── EventService.ts            # 이벤트 CRUD + setlist normalize (id 보존)
│   │   ├── MessageService.ts          # 메시지 영속화 + chatHub publish
│   │   └── AttachmentService.ts       # 디스크 저장 + URL 생성
│   ├── repositories/
│   │   ├── UserRepository.ts          # findById/findByGoogleSub/findByEmail/upsertFromGoogle
│   │   ├── RevokedTokenRepository.ts  # JWT jti 기반 폐기 관리
│   │   ├── BandRepository.ts          # createWithOwner 는 prisma.$transaction 사용
│   │   ├── BandMemberRepository.ts    # countOwners 등 멤버 쿼리
│   │   ├── EventRepository.ts         # 날짜 범위 필터 (ISO 문자열 lexicographic)
│   │   └── MessageRepository.ts       # 커서 기반 페이지네이션 (take=limit+1 트릭)
│   ├── dtos/                          # 모든 DTO 는 interface (Tsoa 검증/스키마 생성)
│   │   ├── auth.dto.ts
│   │   ├── user.dto.ts
│   │   ├── band.dto.ts
│   │   ├── bandMember.dto.ts          # BandMemberRole = 'owner' | 'member'
│   │   ├── event.dto.ts               # EventType = 'practice' | 'performance' | 'other'
│   │   ├── message.dto.ts
│   │   └── attachment.dto.ts
│   ├── middlewares/
│   │   ├── auth.ts                    # Tsoa expressAuthentication: Bearer 파싱 → JWT 검증 → 폐기 체크
│   │   ├── errorHandler.ts            # ValidateError(422) / HttpError / MulterError 매핑
│   │   ├── requestLogger.ts           # 요청 로그 (METHOD path status durationMs)
│   │   └── uploads.ts                 # multer 인스턴스 (image/* 10MB, application/pdf 20MB)
│   ├── errors/
│   │   └── HttpError.ts               # 베이스 HttpError + BadRequest/Unauthorized/Forbidden/NotFound/Conflict
│   ├── ws/
│   │   ├── chatHub.ts                 # in-process EventEmitter pub/sub (band 별 토픽)
│   │   └── chatServer.ts              # ws.WebSocketServer (noServer) + http upgrade 인증
│   ├── types/
│   │   └── express.d.ts               # Express.Request.user 타입 augmentation
│   ├── utils/
│   │   ├── prisma.ts                  # PrismaClient + better-sqlite3 adapter + 경로 정규화
│   │   ├── env.ts                     # dotenv 로드 + 필수 환경변수 가드
│   │   └── logger.ts                  # 간이 console 래퍼
│   ├── routes/                        # (gitignore) Tsoa 가 매번 재생성 — routes.ts + swagger.json
│   ├── app.ts                         # Express 앱 조립 (logger, multer, static, /health, swagger, routes, errors)
│   └── server.ts                      # http.createServer(app) + attachChatServer + listen
├── scripts/
│   ├── smoke-auth.ts                  # 로그인 → 폐기 사이클
│   ├── smoke-bands.ts                 # 18 케이스: 밴드/멤버 권한
│   ├── smoke-events.ts                # 16 케이스: 이벤트 CRUD + setlist id 보존
│   ├── smoke-chat.ts                  # 19 케이스: HTTP + WS 브로드캐스트
│   └── smoke-attachments.ts           # 12 케이스: 업로드 + mime/size 가드
├── uploads/                           # (gitignore) multer 디스크 저장 위치
├── docs/
│   ├── PROJECT_OVERVIEW.md            # 본 문서
│   ├── api/API_LIST.md                # 외부 API 사양 (UI 팀과 합의된 계약)
│   └── YYYY-MM-DD/PROMPTS.md          # 날짜별 작업 기록
├── .env.example                       # DATABASE_URL, PORT, GOOGLE_CLIENT_ID, JWT_SECRET, JWT_EXPIRES_IN
├── .gitignore
├── package.json
├── tsconfig.json
└── tsoa.json                          # entryFile, controllerPathGlobs, securityDefinitions.jwt, authenticationModule
```

### 레이어 의존 규칙
**Controller → Service → Repository → Prisma** 단방향. Controller 는 HTTP 매핑과 DTO 검증만, Service 는 비즈니스 규칙, Repository 만 `@prisma/client` 를 직접 import. Service 끼리는 합성 가능 (예: `BandService` 는 `BandMemberService.assertMember` 위임). `chatHub` 는 service 가 publish, ws 레이어가 subscribe.

## 도메인별 구현 요약

### 1. 인증 (Auth)
- **엔드포인트**: `POST /auth/google` (공개), `POST /auth/logout`, `GET /auth/me` (JWT)
- **흐름**: 클라이언트가 Google ID Token 을 보냄 → `OAuth2Client.verifyIdToken` 으로 검증 → `googleSub` 키로 User upsert → 자체 JWT 발급 (`jti` 포함, 7d 기본). 로그아웃은 `RevokedToken` 테이블에 jti 등록.
- **Tsoa 통합**: `tsoa.json` 의 `authenticationModule: src/middlewares/auth.ts`. 모든 보호 라우트는 `@Security('jwt')`. `expressAuthentication` 의 반환값이 `req.user` (`{ id, jti, expiresAt }`) 로 attach.

### 2. 사용자 (User)
- **엔드포인트**: `GET /users/me`, `PATCH /users/me`
- 프로필 필드: `name`, `email`, `profileImageUrl?`, `instrument?`. Google 로그인 시 picture/email/name 으로 프로필 자동 채움.

### 3. 밴드 (Band) + 멤버 (BandMember)
- **엔드포인트**: `/bands`, `/bands/{bandId}`, `/bands/{bandId}/members[/{userId}]`
- **모델**: `BandMember` 는 `(bandId, userId)` 복합 PK + `role: 'owner'|'member'` (기본 `member`).
- **권한 규칙**:
  - 읽기 (밴드/멤버): 해당 밴드의 멤버.
  - 밴드 PATCH/DELETE: owner.
  - 멤버 초대: owner 만, 해당 email 의 User 가 이미 가입되어 있어야 함 (없으면 404).
  - 멤버 PATCH: owner 는 누구든 role/instrument 변경 가능, 본인은 instrument 만 (role 시도 → 403).
  - 멤버 DELETE: 본인은 자유롭게 탈퇴, owner 는 추방. **마지막 owner 는 demote/kick 불가** (409).

### 4. 일정 (Events)
- **엔드포인트**: `/bands/{bandId}/events[/{eventId}]`
- `type`: `'practice'|'performance'|'other'` (Tsoa 가 422 검증).
- 날짜는 `YYYY-MM-DD` String 으로 저장 (ISO lexicographic 정렬). `?from=&to=` 범위 필터.
- **Setlist** 는 `Json` 컬럼. `SetlistItemRequest.id?` 가 들어오면 보존, 없으면 `crypto.randomUUID()` 로 발급. 클라이언트가 곡 단위로 추적 가능.

### 5. 채팅 (Chat)
- **엔드포인트**: `GET/POST /bands/{bandId}/messages`, `WS /bands/{bandId}/chat?token=<JWT>`
- **HTTP 페이지네이션**: `?cursor=<msgId>&limit=<n>` (기본 50, 최대 200). 응답 `{ messages, nextCursor }`. `take=limit+1` 트릭으로 정확한 `nextCursor` (마지막 페이지면 `null`).
- **WS**:
  - `http.Server.upgrade` 에서 path 매칭 → `?token` 으로 JWT 검증 → 멤버십 체크 → `wss.handleUpgrade`. 실패 시 `401`/`403`/`404` HTTP 응답 후 destroy.
  - 연결 후 `chatHub.subscribe(bandId, ...)` 로 토픽 구독. close 시 자동 unsubscribe.
- **브로드캐스트 통일**: HTTP POST 와 (장래의) WS 송신 모두 `MessageService.send` → `chatHub.publish` 로 흐름. 송신자 본인 소켓도 echo 받음.

### 6. 첨부 (Attachments)
- **엔드포인트**: `POST /attachments/images`, `POST /attachments/files` (둘 다 JWT 필요).
- **multer 정책**: image 는 `image/*` 10MB, file 은 `application/pdf` 20MB. memoryStorage 로 받은 buffer 를 `uploads/{images,files}/<uuid>.<ext>` 로 디스크 저장. mime → 확장자 매핑, 폴백은 originalname.
- **정적 서빙**: `/static/uploads/**` (`express.static`). 응답 URL 은 `${proto}://${host}/static/uploads/...` 절대 경로 (X-Forwarded-Proto 존중).

### 7. 부수 기능
- **Health**: `GET /health` → `{ status: 'ok' }`.
- **Swagger UI**: `GET /docs`.
- **요청 로깅**: 모든 요청에 대해 `[INFO|WARN|ERROR] METHOD path status durationMs` 1줄. 5xx → error, 4xx → warn, 그 외 info.
- **에러 매핑**: `ValidateError`(422) → `HttpError`(statusCode 그대로) → `MulterError`(`LIMIT_FILE_SIZE` → 413, 그 외 400) → 그 외 500.
- **Prisma 경로 정규화**: `src/utils/prisma.ts` 의 `resolveSqliteUrl` 로 CLI 와 driver adapter 가 동일 파일을 보도록 보장.

## 미구현 / TODO
- 자동화된 단위/통합 테스트 (현재는 수동 smoke 스크립트만 있음).
- CI/CD (lint, typecheck, test 파이프라인).
- Docker / 배포 설정.
- 프로덕션용 DB(SQLite → PostgreSQL 등) 이관 + RevokedToken 만료 청소 잡.
- 구조적 로깅(pino/winston) 및 관측성(OpenTelemetry).
- 첨부 파일 프로덕션 스토리지(S3 등) 및 서명 URL.
- 알림(푸시) — API_LIST 범위 외.

## 에이전트를 위한 참고사항

### 코드 컨벤션
- **의존 방향 고정**: Controller → Service → Repository → Prisma. Repository 외의 어느 파일에서도 `@prisma/client` 를 import 하지 말 것 (예외: `BandRepository.createWithOwner` 가 `prisma.$transaction` 으로 두 테이블에 걸친 단일 단위 작업을 수행함 — 같은 데이터 레이어 내부이므로 OK).
- **Tsoa 데코레이터 위치**: `src/controllers/**/*.ts` 만 스캔됨(`tsoa.json` 의 `controllerPathGlobs`).
- **DTO 는 interface**: `src/dtos/` 에 interface 로 정의. literal union (`EventType`, `BandMemberRole`) 도 Tsoa 가 OpenAPI enum 으로 변환.
- **에러 타입**: 도메인 에러는 `src/errors/HttpError.ts` 의 클래스로 throw. `errorHandler` 가 `statusCode` 만 보고 응답 — 새 에러 클래스 추가는 자동으로 매핑됨.
- **인증 컨텍스트**: Tsoa 컨트롤러에서 `@Request() req: ExpressRequest` 로 받고 `req.user!.id` 사용. 타입은 `src/types/express.d.ts` 의 augmentation 으로 보장.
- **환경변수**: `src/utils/env.ts` 의 `env` 객체를 통해서만 접근. 필수 키 누락 시 부팅이 실패함.

### 폴더 규칙
- **새 도메인 추가 시**: `dtos/<name>.dto.ts`, `repositories/<Name>Repository.ts`, `services/<Name>Service.ts`, `controllers/<Name>Controller.ts` 4종 세트로 일관되게 추가. DB 스키마 변경은 `prisma/schema.prisma` 수정 → `npx prisma migrate dev --name <change>`.
- **밴드 권한이 필요하면**: `BandMemberService.assertMember` / `assertOwner` 를 합성. 직접 BandMemberRepository 를 부르지 말 것.
- **유틸**: 도메인 중립이면 `src/utils/`, 요청 처리 흐름에 끼어들면 `src/middlewares/`.

### 작업 시 알아야 할 특이사항
- **Windows 환경**: 개발 OS 가 Windows 11. 쉘은 bash(Git Bash) 사용을 가정하지만 PowerShell 도 사용 가능 (예: `Stop-Process -Name node`).
- **Tsoa 재생성 필요 타이밍**: 컨트롤러/DTO 변경 시 `npm run tsoa` (또는 `npm run dev` 재시작)로 `routes.ts` + `swagger.json` 을 새로 생성. `multer.single('file')` 은 Tsoa 가 모르는 영역이므로 `app.ts` 에서 `RegisterRoutes(app)` **이전에** 직접 mount 해야 `req.file` 이 채워짐.
- **Prisma 변경 + ts-node-dev 충돌**: `npm run dev` 가 살아있는 채로 `prisma migrate/generate` 를 돌리면 query-engine DLL 잠김(EPERM)이 발생. 마이그레이션 전 `Stop-Process -Name node` 로 정리.
- **Prisma JSON 컬럼 입력**: `Prisma.InputJsonValue` 타입이 까다로우므로 `as unknown as Prisma.InputJsonValue` 캐스트로 우회 (Repository 안에서만).
- **WS 인증**: `?token=<JWT>` 쿼리스트링. 헤더 인증(Sec-WebSocket-Protocol)은 미지원. 모바일 클라이언트가 WebSocket API 로 헤더 못 붙이는 경우가 많아 query 방식이 채택됨.
- **DB 파일 위치**: 개발용 SQLite 는 항상 `prisma/dev.db`. 루트에 `dev.db` 가 생긴다면 `resolveSqliteUrl` 로직이 동작하지 않는 상황이므로 디버깅 필요.
- **패키지 매니저**: npm 고정.
