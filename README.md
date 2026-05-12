# CafeChat Linkflow

커피챗 예약 링크를 만드는 모바일 웹앱 프로토타입입니다.

## 로컬 실행

```bash
node local-server.mjs
```

기본 주소는 `http://127.0.0.1:4175`입니다.

## GitHub 업로드

1. 이 폴더를 Git 저장소로 초기화합니다.
2. `main` 브랜치에 푸시합니다.
3. `index.html`이 루트에 있으므로 별도 빌드 없이 정적 사이트로 유지할 수 있습니다.

## Vercel 배포

1. GitHub에 이 폴더를 푸시합니다.
2. Vercel에서 `New Project`를 열고 GitHub 저장소를 연결합니다.
3. Framework Preset은 `Other`로 두고 빌드 명령은 비워둡니다.
4. 배포 후 Root Domain에서 `index.html`이 바로 열리는지 확인합니다.
5. 아래 환경 변수를 설정합니다.
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `OKTA_ISSUER`
   - `OKTA_CLIENT_ID`
   - `OKTA_CLIENT_SECRET`
   - `OKTA_REDIRECT_URI`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `GOOGLE_CALENDAR_ID`
6. 예약 기록을 영구 저장하려면 Vercel KV를 연결합니다.
7. Okta와 Google Redirect URI는 배포 도메인의 `/api/auth/okta/callback` 및 `/api/auth/google/callback`으로 맞춥니다.

## 동작 방식

- 호스트 화면에서 SSO와 캘린더 연결을 설정합니다.
- 게스트는 공유 링크로 들어와 추천 시간만 선택합니다.
- 예약 기록은 브라우저 로컬 저장소를 우선 사용하고, 로컬 서버가 있으면 `/api/bookings`를 사용합니다.
- Vercel 배포에서는 Vercel KV가 있으면 KV를 사용하고, 없으면 메모리 저장소로 동작합니다.
- Okta와 Google OAuth가 설정되면 호스트 연결 상태를 서버 세션에 저장합니다.
- Google Calendar가 연결되면 예약 시 캘린더 이벤트 생성을 시도합니다.
