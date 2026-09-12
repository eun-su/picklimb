# PICKLIMB 출석 기록

승인된 멤버가 날짜별 운동 기록을 직접 남기고, 운영진이 최근 3개월 활동을 확인하는 Firebase 기반 웹 앱입니다.

## 사용 흐름

1. 운영진이 개인별 이름·참여코드·권한을 사전 등록합니다.
2. 멤버는 성함과 개인 참여코드로 입장합니다. 등록되지 않았거나 로그인에 5회 실패하면 입장이 제한됩니다.
3. 이번 달 달력에서 오늘 또는 지난 날짜를 눌러 운동 내용을 저장합니다.
4. 저장된 기록은 같은 날짜를 눌러 수정·삭제할 수 있습니다.
5. 운영진은 운영진 코드로 입장해 전체 멤버의 최근 3개월 기록 횟수와 마지막 기록일을 확인합니다.

## 보안 구조

- 참여코드, 서비스 계정, 로그인 제한 비밀값은 모두 Vercel의 서버 환경 변수에만 둡니다. 브라우저 코드에는 포함되지 않습니다.
- `/api/login`은 승인 목록(`allowedMembers`)에서만 인증하고, IP와 이름 기준 15분에 5회를 넘는 실패 시 30분 동안 차단합니다.
- Firebase Custom Token의 `admin` 클레임과 `firestore.rules`가 멤버 본인 기록과 운영진 전체 조회를 분리합니다.
- Firestore Rules 탭에 반드시 `firestore.rules`를 배포해야 합니다. 기존의 `request.auth != null` 전체 허용 규칙은 사용하면 안 됩니다.

## 최초 설정

### 1. Firebase

Firebase Console에서 Firestore와 Authentication을 만들고, **커스텀 토큰** 로그인을 위한 서비스 계정 JSON을 준비합니다. 웹 앱 구성값은 Vercel의 일반 환경 변수로 등록합니다.

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

### 2. Vercel 비밀 환경 변수

Vercel Production 환경에 아래 두 값을 추가합니다. `FIREBASE_SERVICE_ACCOUNT_JSON`에는 서비스 계정 JSON 전체를 한 줄로 넣고, `LOGIN_RATE_LIMIT_SECRET`에는 충분히 긴 임의 문자열을 넣습니다.

```text
FIREBASE_SERVICE_ACCOUNT_JSON
LOGIN_RATE_LIMIT_SECRET
```

이 값들은 `VITE_` 접두사를 붙이지 마세요. Vercel Functions만 읽어야 하는 비밀값입니다.

### 3. 승인 멤버 등록

`members.example.json`을 `members.private.json`으로 복사해 실제 이름, 개인 참여코드, 역할을 입력합니다. 서비스 계정 JSON 파일도 프로젝트 루트에 `service-account.json`으로 둡니다. 두 파일은 Git에서 제외됩니다.

```bash
npm run provision:members
```

운영진은 `role`을 `admin`, 일반 멤버는 `member`로 지정합니다. 등록을 다시 실행하면 참여코드가 갱신됩니다.

### 4. 배포

환경 변수를 추가하거나 멤버를 등록한 뒤 Vercel에서 새 배포를 실행하세요. Vite만 실행하는 로컬 개발 서버에서는 `/api/login`이 동작하지 않으므로, Firebase 연결 상태로 전체 흐름을 보려면 Vercel 환경에서 확인해야 합니다.

## 카카오톡 캘린더

카카오톡 캘린더의 참석자 명단은 외부 서비스가 자동으로 조회할 수 없으므로, 이 서비스는 실제 참여 여부를 신뢰 기반으로 기록합니다. 멤버가 직접 남긴 날짜별 운동 기록을 운영진이 활동 집계로 확인하는 방식입니다.
