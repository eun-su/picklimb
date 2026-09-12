# PICKLIMB 출석체크

카카오 계정으로 안전하게 로그인하고, 날짜별 출석과 분기별 참여 현황을 확인하는 Firebase 기반 웹 앱입니다.

## 로그인과 권한

- 카카오 로그인은 카카오 고유 회원번호를 Firebase 사용자 ID에 연결합니다. 카카오 닉네임이나 같은 이름만으로 다른 사람의 출석을 수정할 수 없습니다.
- 카카오로 처음 로그인한 계정은 자동으로 `member`(정회원) 권한을 가집니다.
- 초기 관리자(김은수)가 로그인한 뒤 운영 현황에서 로그인 이력이 있는 멤버의 역할을 `member`·`staff`·`admin`으로 바꿀 수 있습니다. 역할 변경 후 대상 멤버가 다시 로그인하면 새 권한이 적용됩니다.
- 운영진은 전체 출석과 참여 날짜를 조회할 수 있고, 관리자만 공지사항과 역할을 변경할 수 있습니다.

## 카카오 로그인 구성

카카오 REST 로그인은 인가 코드 요청, 서버 토큰 교환, 사용자 정보 조회 순서로 구현되어 있습니다. 카카오 공식 문서에 따라 REST API 키, 등록된 리다이렉트 URI, 그리고 필요 시 클라이언트 시크릿을 서버에서만 사용합니다.

### Vercel 환경 변수

Vercel 프로젝트의 **Settings → Environment Variables → Production**에 아래 값을 등록합니다.

```text
# Firebase 웹 앱 설정
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID

# Firebase 서버 인증
FIREBASE_SERVICE_ACCOUNT_JSON

# 카카오 로그인 서버 인증
KAKAO_REST_API_KEY
KAKAO_CLIENT_SECRET
KAKAO_REDIRECT_URI=https://picklimb.vercel.app/api/kakao/login

# 김은수의 카카오 고유 회원번호 (처음 관리자 권한을 만들 때만 필요)
KAKAO_BOOTSTRAP_ADMIN_IDS
```

`FIREBASE_SERVICE_ACCOUNT_JSON`에는 Firebase 서비스 계정 JSON 전체를 한 줄로 넣습니다. `KAKAO_CLIENT_SECRET`은 카카오에서 클라이언트 시크릿을 사용 설정한 경우 필요합니다. 모두 `VITE_` 접두사를 붙이지 않는 비밀 환경 변수입니다.

### Firebase 규칙

Firebase Console의 **Firestore Database → 규칙**에 프로젝트 루트의 `firestore.rules` 전체를 붙여 넣고 게시합니다. 클라이언트는 역할·멤버 정보를 직접 바꿀 수 없으며, 본인 출석만 생성·삭제할 수 있습니다.

## 출석 기능

- 출석 체크 하나가 곧 1회 집계입니다. 별도의 일정 등록 단계는 없습니다.
- 날짜를 누르면 그날 출석한 멤버 이름을 볼 수 있고, 내 출석만 취소할 수 있습니다.
- 데스크톱은 해당 월 달력, 모바일은 오늘 전후 3일의 목록과 더 보기 버튼을 사용합니다.
- 운영진 현황은 이번 분기 출석 수와 마지막 참여일 순서로 제공됩니다.

## 카카오 설정 절차

1. 카카오 디벨로퍼스에서 앱을 만들거나 기존 앱을 선택하고 **카카오 로그인 활성화**를 켭니다.
2. **플랫폼 → Web**에 `https://picklimb.vercel.app`을 등록합니다.
3. **카카오 로그인 → Redirect URI**에 `https://picklimb.vercel.app/api/kakao/login`을 등록합니다.
4. 앱 키의 REST API 키와, 사용 설정했다면 클라이언트 시크릿을 Vercel 환경 변수로 넣습니다.
5. 김은수님이 한 번 카카오 로그인한 뒤 화면에 표시되는 연결 ID를 `KAKAO_BOOTSTRAP_ADMIN_IDS`에 넣고 재배포한 후 다시 로그인합니다.

카카오 로그인 공식 요구 사항인 REST API 키·리다이렉트 URI·동의항목 설정 및 서버 토큰 교환 흐름은 [카카오 로그인 REST API 문서](https://developers.kakao.com/docs/ko/kakaologin/rest-api)를 따릅니다.
