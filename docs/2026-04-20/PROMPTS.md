# 2026-04-20 작업 기록

## 작업 요약
MyBand 애플리케이션 백엔드 서버의 초기 스켈레톤을 구축했다. Node.js + Express 5 + TypeScript + Tsoa + Prisma 6(SQLite driver adapter) 조합으로 MVC(Controller/Service/Repository) 구조를 세우고, 샘플 도메인 `User` 의 CRUD 를 엔드투엔드로 검증했다.

## 작업 배경 및 목적
빈 Git 저장소(README 1파일만 존재) 상태에서 출발해, 앞으로 MyBand 의 실제 도메인(Band, Song, Member 등)을 쌓아올릴 **재현 가능한 기반 구조**를 확보하는 것이 목표였다. 이번 단계에서는 도메인 로직보다 **레이어 분리 규칙과 도구 체인(스펙 자동 생성, ORM, 런타임)의 동작 확인**이 핵심이었다.

## 주요 의사결정 및 사고 과정

### 기술 스택 선택
- **Tsoa 채택**: Express 의 수동 라우팅 + 수동 OpenAPI 작성을 피하고, 데코레이터 기반으로 컨트롤러/스펙/런타임 validation 을 한 번에 해결하기 위함. 대안(express-openapi-validator 등)은 보일러플레이트가 더 많음.
- **Prisma driver adapter 사용**: 사용자가 "최신 SDK, adapter 까지 구축" 을 명시적으로 요청. `@prisma/adapter-better-sqlite3` 는 Prisma 6.19 에서 stable 이며, 로컬 개발에 가장 가볍고 동기 드라이버라 일관된 동작을 보임. libSQL 대안도 고려했지만 당장의 로컬 개발 목적으로는 오버스펙.
- **SQLite**: 초기 프로토타이핑용. 이후 PostgreSQL 이관은 Prisma datasource 한 줄 변경으로 대응 가능.
- **MVC 3-레이어**: Controller/Service/Repository 명시적 분리. `UserRepository` 만 `prisma` 를 직접 import 하도록 제한하여, 추후 DB 교체 시 영향 범위를 좁힘.

### 구조/명명 결정
- `dtos/` 를 별도 폴더로 분리(Service 의 파라미터 타입과 Tsoa OpenAPI 스키마를 한 곳에서 관리).
- 도메인 에러(`NotFoundError`, `ConflictError`)는 `UserService` 파일에 선언. 도메인이 늘어나면 `src/errors/` 로 승격 예정.
- `src/utils/` 에 런타임 공용 유틸(`prisma`, `env`, `logger`). 사용자 지시대로 판단에 따라 구성.

### 어려웠던 부분과 해결
- **SQLite 경로 불일치**: 스모크 테스트에서 `table "User" does not exist` 에러 발생. 원인 추적 결과 Prisma CLI 는 `file:./dev.db` 를 **schema 파일 디렉터리 기준**으로 해석해 `prisma/dev.db` 를 만들지만, `@prisma/adapter-better-sqlite3` 는 **cwd 기준**으로 해석해 프로젝트 루트에 빈 `dev.db` 를 열어버리는 차이 때문. `src/utils/prisma.ts` 에 `resolveSqliteUrl` 헬퍼를 추가해 `file:` URL 을 `process.cwd()/prisma/` 기준 절대경로로 정규화하여 해결.
- **Tsoa 첫 실행 부트스트랩**: `src/app.ts` 가 `src/routes/routes.ts` 와 `swagger.json` 을 import 하는데, 이들은 tsoa 가 생성하는 파일이라 clone 직후엔 없음. `npm run dev`/`npm run build` 스크립트를 `npm run tsoa && ...` 로 체인해서 첫 실행 시 자동 생성되도록 해결. `.gitignore` 에 `src/routes/` 추가.
- **driverAdapters preview 경고**: 최초 `schema.prisma` 에 `previewFeatures = ["driverAdapters"]` 를 넣었더니 Prisma 6.19 에서는 이미 stable 이라 경고 발생. 해당 라인 제거.

## 구현 상세

### 설정 파일
- `package.json`: npm 스크립트 `dev`, `build`, `start`, `prisma:*`, `tsoa`. dependencies/devDependencies 정의.
- `tsconfig.json`: ES2022 타겟, CommonJS, strict, `experimentalDecorators`/`emitDecoratorMetadata` 활성화 (Tsoa 필수).
- `tsoa.json`: `entryFile=src/app.ts`, `controllerPathGlobs=["src/controllers/**/*.ts"]`, `routes/spec → src/routes/`.
- `.env.example`: `DATABASE_URL="file:./dev.db"`, `PORT=3000`.
- `.gitignore`: `node_modules/`, `dist/`, `.env`, `*.db`, `src/routes/`.

### Prisma
- `prisma/schema.prisma`: SQLite datasource + `User` 모델(id, email unique, name, createdAt).
- `prisma/migrations/20260420135816_init/`: 초기 마이그레이션 생성 완료, `prisma/dev.db` 에 반영.

### 소스 트리 (src/)
- `utils/env.ts`: `dotenv/config` 로드 + `DATABASE_URL` 필수 체크, `PORT` 파싱.
- `utils/prisma.ts`: `PrismaBetterSQLite3` 어댑터로 `PrismaClient` 생성. `resolveSqliteUrl` 로 경로 정규화.
- `utils/logger.ts`: `[INFO]`/`[WARN]`/`[ERROR]` prefix 를 붙이는 간이 console 래퍼.
- `dtos/user.dto.ts`: `UserResponse`, `CreateUserRequest`, `UpdateUserRequest` interface.
- `repositories/UserRepository.ts`: `findAll/findById/findByEmail/create/update/delete` — Prisma 호출만 래핑.
- `services/UserService.ts`: 비즈니스 규칙(중복 체크, 존재 검증)과 Prisma 모델 → DTO 변환. `NotFoundError`/`ConflictError` 정의.
- `controllers/UserController.ts`: Tsoa 데코레이터 기반 5개 엔드포인트.
- `middlewares/errorHandler.ts`: `ValidateError` → 422, `NotFoundError` → 404, `ConflictError` → 409, 기타 → 500. `notFoundHandler` 도 함께.
- `app.ts`: Express 앱 조립(`express.json`, `/health` 핸들러, Swagger UI, `RegisterRoutes`, 404/에러 핸들러).
- `server.ts`: `app.listen(env.PORT, ...)` 엔트리.

### 검증
- `npx tsc --noEmit` 통과.
- `ts-node-dev` 로 서버 기동 → `GET /health` 200, `POST /users`/`GET /users`/`GET /users/1` 정상 응답, `GET /docs` 200(Swagger UI 노출) 확인. 샘플 데이터가 `prisma/dev.db` 에 영속화됨.

## 다음 작업을 위한 메모

### 이어서 작업할 사항
- MyBand 실제 도메인 모델 설계 (Band, Member, Song, Session 등) 및 스키마 반영.
- 인증/인가 전략 결정(JWT vs 세션, 소셜 로그인 여부 등).
- 요청 로깅 미들웨어 추가(현 `logger` 는 ad-hoc 성). morgan/pino-http 등 검토.
- 테스트 프레임워크 도입(Vitest 권장) + Repository 는 실제 SQLite, Service 는 repo mock, Controller 는 supertest 로 E2E.
- lint/format(ESLint + Prettier) 도입.

### 주의사항
- **컨트롤러/DTO 변경 시 반드시 `npm run tsoa` 실행**. 안 하면 런타임 라우트와 OpenAPI 가 구버전으로 굳음.
- **Repository 밖에서 `@prisma/client` import 금지** — 레이어 경계 유지.
- **DB 파일 위치 검증**: 만약 프로젝트 루트에 `dev.db` 가 새로 생기면 `resolveSqliteUrl` 의 cwd 가정이 깨진 상황. Docker/모노레포로 전환 시 특히 주의.
- **커스텀 도메인 에러 추가 시** `errorHandler.ts` 에 매핑을 함께 추가하지 않으면 500 으로 떨어짐.
- **Prisma 6 → 7 업그레이드 안내가 경고로 떴지만** 이번 작업에서는 스코프 밖. 업그레이드는 별도 작업으로 분리하고 adapter breaking change 여부 확인 필요.
