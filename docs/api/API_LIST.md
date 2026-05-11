# MyBand API 목록

> 작성일: 2026-04-20  
> 기준: README.md, PROJECT_OVERVIEW.md  
> 현재 앱은 Mock 데이터 사용 중. 이 문서는 백엔드 연동 시 필요한 REST API 전체 목록이다.

---

## 공통 사항

- **Base URL**: 미정 (개발: `http://localhost:8080`, 운영: TBD)
- **인증 방식**: 모든 API (로그인 제외) — `Authorization: Bearer {JWT}` 헤더
- **날짜 형식**: ISO 8601 (`YYYY-MM-DD` 또는 `YYYY-MM-DDTHH:mm:ssZ`)
- **에러 응답 형식**:
```json
{
  "code": "ERROR_CODE",
  "message": "에러 설명"
}
```

---

## 1. 인증 (Auth)

Google OAuth ID Token을 서버에 전달하면 서버가 자체 JWT를 발급하는 방식.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/auth/google` | Google ID Token으로 로그인, 서버 JWT 발급 |
| `POST` | `/auth/logout` | 로그아웃 (서버 측 토큰 무효화) |
| `GET` | `/auth/me` | 현재 로그인 사용자 정보 조회 |

**POST `/auth/google` 요청 바디:**
```json
{
  "idToken": "구글에서_받은_ID_토큰"
}
```

**POST `/auth/google` 응답:**
```json
{
  "accessToken": "서버_JWT",
  "user": {
    "id": "user_001",
    "name": "김보컬",
    "email": "user@gmail.com",
    "profileImageUrl": "https://..."
  }
}
```

---

## 2. 사용자 (User)

프로필 화면(미구현) 및 밴드 멤버 표시에 필요.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/users/me` | 내 프로필 조회 |
| `PATCH` | `/users/me` | 내 프로필 수정 |

**GET `/users/me` 응답:**
```json
{
  "id": "user_001",
  "name": "김보컬",
  "email": "user@gmail.com",
  "profileImageUrl": "https://...",
  "instrument": "Vocal/Guitar"
}
```

**PATCH `/users/me` 요청 바디:**
```json
{
  "name": "김보컬",
  "instrument": "Vocal/Guitar",
  "profileImageUrl": "https://..."
}
```

---

## 3. 밴드 (Band)

앱 상단 드롭다운에서 복수 밴드 전환, 밴드 정보 표시에 필요.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/bands` | 내 소속 밴드 목록 조회 |
| `POST` | `/bands` | 새 밴드 생성 |
| `GET` | `/bands/:bandId` | 밴드 상세 조회 |
| `PATCH` | `/bands/:bandId` | 밴드 정보 수정 |
| `DELETE` | `/bands/:bandId` | 밴드 삭제 |

**GET `/bands` 응답:**
```json
[
  {
    "id": "b1",
    "name": "인디스타즈",
    "description": "홍대 모던락 밴드",
    "memberCount": 4
  }
]
```

**POST `/bands` / PATCH `/bands/:bandId` 요청 바디:**
```json
{
  "name": "인디스타즈",
  "description": "홍대 모던락 밴드"
}
```

---

## 4. 밴드 멤버 (Band Members)

멤버 목록 조회, 초대, 정보 수정, 탈퇴/추방에 필요.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/bands/:bandId/members` | 밴드 멤버 목록 조회 |
| `POST` | `/bands/:bandId/members` | 멤버 초대 |
| `PATCH` | `/bands/:bandId/members/:userId` | 멤버 악기/역할 수정 |
| `DELETE` | `/bands/:bandId/members/:userId` | 멤버 탈퇴 또는 추방 |

**GET `/bands/:bandId/members` 응답:**
```json
[
  {
    "id": "user_001",
    "name": "김보컬",
    "instrument": "Vocal/Guitar",
    "profileImageUrl": "https://..."
  }
]
```

**POST `/bands/:bandId/members` 요청 바디:**
```json
{
  "email": "newmember@gmail.com",
  "instrument": "Bass"
}
```

---

## 5. 일정 (Events)

메인 화면 일정 모아보기, 캘린더, 일정 추가/상세/수정/삭제에 필요.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/bands/:bandId/events` | 밴드 일정 목록 조회 |
| `POST` | `/bands/:bandId/events` | 일정 생성 |
| `GET` | `/bands/:bandId/events/:eventId` | 일정 상세 조회 |
| `PATCH` | `/bands/:bandId/events/:eventId` | 일정 수정 |
| `DELETE` | `/bands/:bandId/events/:eventId` | 일정 삭제 |

**GET `/bands/:bandId/events` 쿼리 파라미터:**
- `from`: 시작 날짜 (`YYYY-MM-DD`)
- `to`: 종료 날짜 (`YYYY-MM-DD`)
- 예) `GET /bands/b1/events?from=2026-04-01&to=2026-04-30`

**GET `/bands/:bandId/events` 응답:**
```json
[
  {
    "id": "e1",
    "title": "정기 합주",
    "date": "2026-04-25",
    "type": "practice",
    "description": "다음 주 공연을 위한 리허설",
    "setlist": [
      {
        "id": "s1",
        "title": "별빛이 내린다",
        "artist": "안녕바다",
        "key": "C Major",
        "sheetMusicUrl": null,
        "references": []
      }
    ]
  }
]
```

**POST `/bands/:bandId/events` / PATCH `…/:eventId` 요청 바디:**
```json
{
  "title": "정기 합주",
  "date": "2026-04-25",
  "type": "practice",
  "description": "리허설 및 사운드 체킹",
  "setlist": [
    {
      "title": "별빛이 내린다",
      "artist": "안녕바다",
      "key": "C Major",
      "sheetMusicUrl": "https://...",
      "references": ["https://youtube.com/watch?v=..."]
    }
  ]
}
```

> `type` 허용값: `practice` (합주) | `performance` (공연) | `other` (기타)

---

## 6. 채팅 (Chat)

채팅 메시지 목록 조회, 전송, 실시간 수신에 필요.

| 메서드/프로토콜 | 경로 | 설명 |
|-----------------|------|------|
| `GET` | `/bands/:bandId/messages` | 채팅 메시지 목록 (페이지네이션) |
| `POST` | `/bands/:bandId/messages` | 텍스트 메시지 전송 |
| `WebSocket` | `ws://.../bands/:bandId/chat` | 실시간 메시지 수신 |

**GET `/bands/:bandId/messages` 쿼리 파라미터:**
- `cursor`: 마지막 메시지 ID (커서 기반 페이지네이션)
- `limit`: 불러올 메시지 수 (기본값: 50)

**GET `/bands/:bandId/messages` 응답:**
```json
{
  "messages": [
    {
      "id": "msg_001",
      "senderId": "user_001",
      "senderName": "김보컬",
      "senderProfileImageUrl": "https://...",
      "text": "이번 주 합주 준비 다들 됐나요?",
      "createdAt": "2026-04-20T14:30:00Z"
    }
  ],
  "nextCursor": "msg_050"
}
```

**POST `/bands/:bandId/messages` 요청 바디:**
```json
{
  "text": "메시지 내용"
}
```

**WebSocket 수신 메시지 형식:**
```json
{
  "type": "message",
  "data": {
    "id": "msg_002",
    "senderId": "user_002",
    "senderName": "이베이스",
    "text": "준비 완료!",
    "createdAt": "2026-04-20T14:31:00Z"
  }
}
```

---

## 7. 첨부파일 (Attachments)

채팅 첨부 메뉴의 이미지/PDF 업로드에 필요.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/attachments/images` | 이미지 업로드, URL 반환 |
| `POST` | `/attachments/files` | PDF/파일 업로드, URL 반환 |

**POST `/attachments/images` 요청:**
- Content-Type: `multipart/form-data`
- 필드: `file` (이미지 바이너리)

**응답:**
```json
{
  "url": "https://cdn.myband.app/images/abc123.jpg"
}
```

---

## API 구현 우선순위

| 우선순위 | 도메인 | 이유 |
|---------|--------|------|
| 1순위 | 인증 (Auth) | 로그인 없이 다른 API 사용 불가 |
| 2순위 | 밴드 + 멤버 (Band, Members) | 앱 메인 화면의 핵심 데이터 |
| 3순위 | 일정 (Events) | 일정 추가/조회 기능 연동 |
| 4순위 | 채팅 (Chat) | 실시간 WebSocket 포함으로 복잡도 높음 |
| 5순위 | 첨부파일 (Attachments) | 이미지/PDF 피커 UI도 미구현 상태 |
| 6순위 | 사용자 (User) | 프로필 화면 자체가 미구현 |
