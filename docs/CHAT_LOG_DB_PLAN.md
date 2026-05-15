# Chat Log DB Plan

## Goal

채팅 메시지 기록을 일반 서비스 데이터와 분리해, 밴드별 채팅 로그를 안정적으로 저장하고 빠르게 조회할 수 있는 별도 저장 계층을 설계한다. 이 문서는 구현 계획이며 현재 코드에는 적용하지 않는다.

## Scope

- 밴드 단위 채팅방의 append-only 메시지 로그 저장
- 메시지 목록 커서 페이지네이션
- 실시간 전송과 영구 저장의 순서 보장
- 장애 복구, 재전송, 중복 방지 기준 정의
- 기존 채팅 API와 호환되는 단계적 전환

## Proposed Data Model

### ChatRoom

밴드와 채팅 로그 저장소의 논리적 방을 연결한다.

- `id`: 내부 채팅방 ID
- `bandId`: 기존 밴드 ID
- `createdAt`
- `updatedAt`
- `lastMessageId`
- `lastMessageAt`

Index:

- unique `bandId`
- `lastMessageAt`

### ChatLog

채팅 메시지의 원본 로그 테이블이다. 수정/삭제도 가능하면 새 이벤트로 남기는 append-only 방식을 우선 검토한다.

- `id`: 메시지 ID
- `roomId`
- `bandId`: 조회 최적화를 위한 중복 저장
- `senderId`
- `senderNameSnapshot`
- `senderAvatarUrlSnapshot`
- `type`: `TEXT`, `IMAGE`, `FILE`, `SYSTEM`
- `text`
- `payloadJson`: 첨부 파일, 이미지 메타데이터 등 확장 필드
- `sequence`: 방 안에서 증가하는 정렬 번호
- `idempotencyKey`: 클라이언트 재시도 중복 방지용
- `createdAt`
- `editedAt`
- `deletedAt`

Index:

- unique `(roomId, sequence)`
- unique `(roomId, idempotencyKey)`
- `(roomId, createdAt, id)`
- `(bandId, createdAt, id)`
- `(senderId, createdAt)`

### ChatOutbox

DB 저장과 실시간 fan-out 사이의 장애를 줄이기 위한 발행 대기 테이블이다.

- `id`
- `chatLogId`
- `roomId`
- `eventType`
- `payloadJson`
- `publishedAt`
- `createdAt`

Index:

- `(publishedAt, createdAt)`
- `chatLogId`

## Write Flow

1. 클라이언트가 HTTP 또는 WebSocket으로 메시지 전송을 요청한다.
2. 백엔드는 기존 DB에서 사용자의 밴드 멤버십을 검증한다.
3. Chat Log DB 트랜잭션에서 `ChatRoom`을 조회하거나 생성한다.
4. 같은 트랜잭션에서 다음 `sequence`를 할당하고 `ChatLog`를 append한다.
5. `ChatOutbox`에 실시간 발행 이벤트를 기록한다.
6. 커밋 이후 outbox worker가 WebSocket 구독자에게 메시지를 전달한다.
7. API 응답은 저장된 `ChatLog` 기준으로 반환한다.

## Read Flow

1. 채팅방 진입 시 `bandId`로 `ChatRoom`을 찾는다.
2. 초기 조회는 최신 메시지를 `limit`만큼 가져온 뒤 오래된 순서로 반환한다.
3. 이전 메시지 로딩은 `(sequence)` 또는 `(createdAt, id)` 커서로 조회한다.
4. 닉네임/프로필 이미지는 로그에 저장된 snapshot을 우선 사용한다.
5. 최신 프로필 표시가 꼭 필요한 화면만 기존 사용자 DB를 별도로 hydrate한다.

## API Compatibility Plan

기존 API는 유지하고 내부 저장소만 단계적으로 교체한다.

- `GET /bands/:bandId/messages`: Chat Log DB에서 읽도록 전환
- `POST /bands/:bandId/messages`: Chat Log DB에 append하도록 전환
- `WS /bands/:bandId/messages`: outbox 기반 이벤트를 구독하도록 전환

응답 DTO는 현재 FE `ChatMessage` 모델과 호환되게 유지한다.

## Migration Plan

1. Chat Log DB 스키마와 연결 설정만 추가한다.
2. 기존 메시지 테이블에서 Chat Log DB로 backfill 스크립트를 준비한다.
3. 일정 기간 dual-write를 적용해 기존 DB와 Chat Log DB에 동시에 기록한다.
4. shadow-read로 두 저장소의 메시지 개수, 최신 메시지, 정렬을 비교한다.
5. 읽기 경로를 Chat Log DB로 전환한다.
6. 안정화 후 기존 메시지 저장 로직을 read-only 또는 archive 대상으로 낮춘다.

## Failure Policy

- 멤버십 검증 실패: `403 Forbidden`
- Chat Log DB 저장 실패: 메시지를 전송하지 않고 `503` 또는 재시도 가능 에러 반환
- outbox 발행 실패: 메시지는 저장된 상태로 유지하고 worker가 재시도
- 중복 전송: `idempotencyKey`가 같으면 기존 저장 메시지를 반환
- WebSocket 일시 끊김: 클라이언트가 재접속 후 마지막 수신 커서 기준으로 누락 메시지를 조회

## Open Decisions

- 별도 DB를 PostgreSQL로 둘지, MongoDB/DynamoDB 같은 로그 친화 저장소로 둘지 결정 필요
- `sequence` 할당을 DB lock, sequence table, Redis counter 중 무엇으로 처리할지 결정 필요
- 메시지 삭제 정책을 soft delete로 둘지 tombstone 이벤트로 남길지 결정 필요
- 첨부 파일 원본 저장소와 채팅 로그 메타데이터의 소유권 경계 결정 필요
- 검색 기능이 필요하면 전문 검색 인덱스 또는 별도 검색 엔진 연동 검토 필요
