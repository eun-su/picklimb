# PICKLIMB 출석체크

피클즈 멤버가 출석을 남기고, 날짜별 참가자와 분기별 참여 현황을 확인하는 Firebase 기반 웹 앱입니다.

## 기능과 권한

| 구분 | 대상 | 할 수 있는 일 |
| --- | --- | --- |
| 관리자 | 김은수 | 출석, 전체 참가 현황·상세 날짜 조회, 공지사항·이용가이드 수정 |
| 운영진 | 이하은·주영익·안정민·홍성준·김예지 | 출석, 전체 참가 현황·상세 날짜 조회 |
| 정회원 | 승인된 일반 멤버 | 출석 등록·본인 출석 취소, 날짜별 참가자 이름·전체 출석 수 조회 |

- 출석 체크는 별도의 일정 등록 없이 한 번의 출석 기록으로 바로 1회 집계됩니다.
- 모든 로그인 멤버는 날짜를 눌러 그날 출석한 이름을 볼 수 있습니다. 다른 사람의 출석은 수정하거나 삭제할 수 없습니다.
- 데스크톱은 실제 날짜 기준의 이번 달 달력, 모바일은 오늘 전후 3일의 단일 목록과 더 보기 버튼을 보여 줍니다.
- 운영진 현황은 이번 분기 출석 횟수·마지막 참여일을 기준으로 정렬하며, 멤버를 누르면 참여 날짜를 확인할 수 있습니다.

## 보안 구조

- 승인 명단과 참여코드의 bcrypt 해시는 Firestore의 `allowedMembers`에만 두고, 브라우저에서 직접 읽을 수 없게 했습니다.
- `/api/login`만 명단을 확인해 Firebase Custom Token을 발급합니다. 로그인 실패는 IP와 성함 기준 15분에 5회까지만 허용하고, 초과 시 30분 차단합니다.
- Firestore 보안 규칙은 본인 출석만 생성·수정·삭제하게 하고, 운영진은 조회만 넓게 허용합니다. 공지사항 쓰기는 관리자만 가능합니다.

## 최초 설정

### 1. Firebase 규칙 배포

Firebase Console의 **Firestore Database → 규칙**에 프로젝트 루트의 `firestore.rules` 전체를 붙여 넣고 게시합니다. 기존의 전체 허용 규칙은 교체해야 합니다.

### 2. Vercel 환경 변수

Vercel 프로젝트의 **Settings → Environment Variables → Production**에 아래를 추가합니다. `VITE_` 항목은 Firebase 웹 앱 설정값이고, 나머지 두 항목은 서버만 읽는 비밀값입니다.

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
FIREBASE_SERVICE_ACCOUNT_JSON
LOGIN_RATE_LIMIT_SECRET
```

`FIREBASE_SERVICE_ACCOUNT_JSON`에는 Firebase 서비스 계정 JSON 파일 전체를 한 줄로 넣습니다. `LOGIN_RATE_LIMIT_SECRET`에는 충분히 긴 임의 문자열을 넣습니다. 두 값에는 절대 `VITE_` 접두사를 붙이지 않습니다.

### 3. 승인 멤버 등록

`members.example.json`을 `members.private.json`으로 복사해 실제 이름, 역할, 개인 참여코드를 입력하고, 서비스 계정 JSON 파일을 프로젝트 루트의 `service-account.json`으로 둡니다. 두 파일은 GitHub에 올라가지 않도록 제외되어 있습니다.

```bash
npm install
npm run provision:members
```

`role` 값은 `admin`, `staff`, `member` 중 하나입니다. 같은 이름은 로그인에서 구분할 수 없으므로 중복될 수 없습니다. 등록을 다시 실행하면 해당 멤버의 참여코드가 새 해시로 갱신됩니다.

### 4. 배포 확인

Vercel 환경 변수와 승인 멤버 등록을 마친 뒤 새 배포를 실행합니다. 실제 로그인 흐름은 Vercel 배포 주소에서 확인합니다.

## 카카오톡 캘린더

카카오톡 캘린더 참석자 명단은 외부 서비스가 자동으로 조회할 수 없으므로, 피클즈 출석체크는 실제 운동 후 멤버가 신뢰 기반으로 직접 체크하는 방식입니다.
