---
name: push
description: 변경사항을 커밋하고 GitHub에 새 브랜치로 푸시합니다. 커밋 메세지 컨벤션 — feat:/docs:/fix:
argument-hint: "feat|docs|fix: 커밋 메세지"
allowed-tools: Bash
---

## 지시사항

변경사항을 커밋하고 GitHub origin에 새 브랜치로 푸시합니다.
인자: $ARGUMENTS

---

### STEP 1: 현재 상태 파악

아래 명령을 실행해 변경사항과 최근 커밋 히스토리를 확인하세요.

```
git status
git diff --stat
git log --oneline -5
```

---

### STEP 2: 커밋 메세지 결정

`$ARGUMENTS`가 제공된 경우 그 값을 커밋 메세지로 사용합니다.
제공되지 않은 경우, STEP 1에서 확인한 변경사항을 바탕으로 아래 컨벤션에 맞게 메세지를 작성합니다.

**커밋 메세지 컨벤션:**
- 기능 추가: `feat: 설명`
- 문서 작성/수정: `docs: 설명`
- 오류 수정: `fix: 설명`

메세지는 한국어로 작성하고, 50자 이내로 간결하게 작성합니다.

---

### STEP 3: 브랜치명 결정

커밋 메세지의 prefix와 내용으로 브랜치명을 생성합니다.

규칙:
- 형식: `{prefix}/{kebab-case-description}`
- prefix는 커밋 메세지의 `feat` / `docs` / `fix` 사용
- description은 영어 소문자 + 하이픈 조합 (예: `add-event-screen`)
- 예시: `feat/add-event-creation`, `docs/update-overview`, `fix/provider-type-error`

---

### STEP 4: 커밋 및 푸시 실행

아래 순서대로 실행합니다.

1. 스테이징
```
git add ./
```

2. 커밋 (HEREDOC 형식 사용)
```
git commit -m "$(cat <<'EOF'
{커밋 메세지}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

3. 새 브랜치 생성 및 푸시
```
git push origin HEAD:{브랜치명}
```

---

### STEP 5: 완료 보고

푸시 완료 후 사용자에게 다음을 보고하세요:
- 커밋 메세지
- 푸시된 브랜치명
- 변경된 파일 수 (git diff --stat 결과 요약)
