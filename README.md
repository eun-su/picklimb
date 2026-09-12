# PICKLIMB 출석 시스템

피클즈 운동 일정별 출석 확인, 멤버별 누적 참여 횟수, 마지막 참여일 기준 정렬을 제공하는 웹 앱입니다.

## 포함된 기능

- 성함 + 참여코드로 멤버 페이지 입장, 운영진 코드로 일정 생성 및 전체 출석 처리
- 운동 일정 생성 및 카카오톡 캘린더 링크 연결
- 일정별 참석 인원과 전체 대비 참석률 확인
- 멤버별 출석 처리, 누적 참여 수, 마지막 참여일 조회 및 이름 검색
- Firebase 설정 전에도 화면 검토를 위한 데모 데이터로 동작

## Firebase Spark 설정

1. Firebase Console에서 Web 앱을 추가하고 **Authentication > Sign-in method > 익명**을 사용 설정합니다.
2. Firestore Database를 생성한 뒤, `firestore.rules`의 규칙을 Rules 탭에 배포합니다.
3. `.env.example`을 복사해 `.env.local`로 이름을 바꾸고 Firebase 구성값과 참여코드를 입력합니다.
4. Vercel 프로젝트의 Environment Variables에도 같은 `VITE_` 환경 변수를 추가합니다.

`VITE_ACCESS_CODE`는 화면 입장을 편하게 제한하는 용도입니다. Vite 환경 변수는 브라우저에 포함되므로 비밀 비밀번호로 사용하면 안 됩니다. 실제 데이터 접근은 Firebase Authentication과 Firestore 규칙이 담당합니다.

## 배포

```bash
npm run build
```

GitHub 저장소를 Vercel에 연결하면 `main` 브랜치 푸시마다 자동 배포됩니다. 카카오톡 캘린더 API로는 로그인 사용자의 일정 관리와 공유 캘린더 연결은 가능하지만, 전체 참석자 명단을 외부 서비스가 조회하는 기능은 제공되지 않습니다. 따라서 이 서비스가 Firebase에 최종 출석을 기록합니다.
