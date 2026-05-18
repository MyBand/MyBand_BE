# GitHub Actions Deployment

`main` 브랜치에 push 또는 merge가 발생하면 `.github/workflows/deploy.yml`이 실행된다.

## Flow

1. GitHub Actions가 코드를 checkout한다.
2. `npm ci`와 `npm run build`로 배포 전 빌드 검증을 수행한다.
3. SSH 키로 홈서버에 접속한다.
4. 서버 배포 경로에 소스 파일을 동기화한다.
5. GitHub Secrets 값으로 서버의 `.env` 파일을 생성한다.
6. 홈서버에서 기존 compose 서비스를 `docker compose down --remove-orphans`로 종료한다.
7. `docker compose up -d --build --remove-orphans`로 다시 실행한다.
8. `app`, `nginx` 컨테이너가 모두 `healthy`가 될 때까지 대기한다.

## Required GitHub Secrets

- `HOME_SERVER_HOST`: 홈서버 주소
- `HOME_SERVER_PORT`: SSH 포트, 비워두면 `22`
- `HOME_SERVER_USER`: SSH 사용자
- `HOME_SERVER_SSH_KEY`: SSH private key
- `HOME_SERVER_PATH`: 서버 배포 경로
- `GOOGLE_CLIENT_ID`: 기본 Google OAuth client id
- `JWT_SECRET`: 운영 JWT 서명 키
- `FRONTEND_URL`: 운영 프론트엔드 URL

## Optional GitHub Secrets

- `DATABASE_URL`: 비워두면 `file:./app.db`
- `GOOGLE_WEB_CLIENT_ID`
- `GOOGLE_ANDROID_CLIENT_ID`
- `GOOGLE_IOS_CLIENT_ID`
- `GOOGLE_CLIENT_IDS`
- `FRONTEND_URLS`: comma-separated additional frontend origins
- `JWT_EXPIRES_IN`: 비워두면 `7d`

## Server Notes

홈서버에는 Docker와 Docker Compose plugin이 설치되어 있어야 한다.

`config/ssl`, `uploads`, SQLite DB 파일은 동기화 제외 대상이다. 서버에 이미 존재하는 인증서, 업로드 파일, DB 파일을 배포 중 덮어쓰지 않기 위함이다.
