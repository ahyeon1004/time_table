# BSSM 시간표

Figma 시안을 바탕으로 만든 데스크톱 시간표 웹입니다. React, Vite, Tailwind CSS와 Gmarket Sans를 사용합니다.

## 프로젝트 폴더

이 폴더(`개인프로젝트`)에서 `npm run dev`를 실행하거나 `실행.command`를 열면 됩니다. 나이스 인증키는 `.env.local`에 보관합니다.

## 나이스 시간표 연결

1. https://open.neis.go.kr/portal/guide/actKeyPage.do 에서 로그인 후 Open API 인증키를 발급받습니다.
2. 프로젝트의 `.env.local`에 다음 값을 설정합니다. `.env.example`을 복사해 만들어도 됩니다.

```dotenv
NEIS_API_KEY=발급받은키
```

3. `npm run dev`로 실행하고 시간표의 **새로고침**을 누릅니다. 이미 실행 중이라면 새로고침만 해도 서버가 파일을 다시 읽습니다.

인증키는 서버에서만 읽으며 브라우저 번들·API 응답에 포함하지 않습니다. `VITE_` 접두사를 붙이지 마세요. `.env.local`은 서버에서만 읽는 로컬 설정 파일입니다. 인증키가 없으면 연결 안내를 표시하며 예시 과목으로 대체하지 않습니다.

키 없이 조회하는 나이스 샘플은 5건으로 제한되어 전체 주간 시간표로 사용할 수 없습니다. 응답 건수가 전체 건수보다 적으면 연결 오류로 처리합니다.

### 조회 대상 및 제공 범위

- 학교: 부산소프트웨어마이스터고등학교
- 교육청 코드: `C10`, 학교 코드: `7150658` — 공식 학교정보 API에서 확인
- 공식 API: `https://open.neis.go.kr/hub/hisTimetable`
- 학년·반·선택한 월요일~금요일로 조회하며 주간 이동과 학급 변경에 따라 다시 불러옵니다.
- 교사명과 실제 이동 교실은 나이스 시간표 응답에 포함되지 않습니다. 1학년과 2학년 전체 반 교사명은 사용자가 제공한 별도 정보로 표시하며, 미등록 수업은 ‘교사 정보 미제공’으로 표시합니다. 알고리즘 담당은 1학년 반별 요일·교시 기준으로 적용합니다. 2반은 목요일 4교시, 3반은 월요일 전체 알고리즘 수업, 4반은 금요일 1교시만 김미영 교사이며 해당 반의 나머지 알고리즘 수업은 염혜린 교사입니다. 1학년 과목명 끝의 2는 생략하며 원본명은 보존합니다. 이동 교실은 사용자가 설정합니다.
- 동일 교시의 여러 선택과목은 함께 표시합니다. 비어 있는 교시·휴업일·미공개 주간은 임의 과목으로 채우지 않습니다.
- 과목 데이터만 실제 연동됩니다. 수업 시작·종료 시각은 기존 기본 설정(08:40 시작, 수업 50분, 쉬는 시간 10분, 4교시 뒤 점심 50분)입니다. 실제 학교 일과표와 일치하는지 확인해야 하며, 단축수업은 날짜별 설정으로 반영됩니다.
- 나이스 공개 자료가 학교의 당일 변경 시간표보다 늦게 갱신될 수 있습니다.

## 실행과 배포

Node.js 24 이상이 필요합니다. 인증 정보는 내장 SQLite를 사용합니다.

```sh
npm install
npm run dev
```

macOS에서는 `실행.command`로도 실행할 수 있습니다.

```sh
npm test        # 시간 계산·데이터 변환·API 검증 테스트
npm run build   # 브라우저 배포용 파일 생성
npm run preview # 빌드 확인, 나이스 API도 함께 제공
npm start       # dist/와 서버 API 제공 (기본 127.0.0.1:3000)
```

운영 배포는 Node 서버(`npm start`)가 필요합니다. `dist/`만 정적 호스팅하면 `/api/timetable`이 없어 조회할 수 없습니다. 운영 환경에서는 `NEIS_API_KEY` 환경변수를 등록하고 필요하면 `HOST`, `PORT`를 지정합니다.

## 주요 기능

- 로그인·회원가입·Google 인증 안내와 학생 정보 등록
- 월간 달력, 이전 주·다음 주·오늘 이동, 학급 변경, 나이스 새로고침
- 실제 과목별 파스텔 카드, 수업 없음·조회 중·오류 상태
- 실제 조회된 과목을 이용한 현재 교시·다음 수업 안내와 미리보기
- 모든 수업 카드의 이동 교실 설정: 매주 반복 또는 날짜별 적용
- 학년·반·과목이 달라지면 이전 이동 교실을 잘못 적용하지 않도록 분리
- 날짜별 단축수업 및 점심시간 조정, 즉시 미리보기, 설정 해제
- 화면 알림·알림음 토글, 알림음 재생, 알림 예시
- 페이지가 열려 있는 동안 실제 조회된 다음 수업의 5분 전 안내
- 브라우저 저장, 키보드 탐색, 모달 Escape 닫기, 포커스 복귀

Google OAuth는 서버 인증 코드 방식으로 연결됩니다. bssm.hs.kr 학교 Google Workspace 계정만 가입할 수 있습니다. Google Cloud OAuth 클라이언트 설정이 완료되어야 실제 로그인이 가능합니다. 알림은 페이지 안에서 표시하며, 닫힌 페이지의 기기 알림은 웹 푸시로 제공합니다.

기존 예시 시간표에 저장한 이동 교실·단축수업 설정은 실제 시간표에 자동 적용하지 않습니다. 실제 연동 설정은 별도 저장 키(`bssm.movements.neis.v1`, `bssm.short.neis.v1`)를 사용합니다. 학생 정보와 알림 설정은 유지합니다.

## 구조

```text
server/
  neis.js                 나이스 API 조회·검증·캐시, 비공개 인증키 로딩
  neis.test.js            API 경계·키 보호·오류·캐시 테스트
  index.js                운영용 정적 파일 및 API 서버
src/
  App.jsx                 라우팅, 저장 상태, 알림, 시간표 데이터 연결
  components/Auth.jsx     인증 시연 및 학생 정보
  components/Dashboard.jsx 달력·시간표·조회 상태
  components/Settings.jsx 이동 교실·단축수업·알림 설정
  components/ui.jsx       공통 UI
  lib/schedule.js         날짜·교시 시간·현재/다음 수업 계산
  lib/timetable.js        나이스 데이터 변환
  lib/useTimetable.js     학급·주간별 조회, 캐시, 요청 취소
  styles.css              Gmarket Sans와 UI 스타일
public/fonts/             공식 원본 글꼴과 라이선스
```

Figma: https://www.figma.com/design/iczliaysD0l7XLkRi7B8kk

나이스 API 명세: https://open.neis.go.kr/portal/data/service/selectServicePage.do?infId=OPEN18620200826103326268120&infSeq=2&page=1&rows=10

Gmarket Sans: https://corp.gmarket.com/fonts/ — 원본 라이선스는 `public/fonts/LICENSE.txt`에 포함했습니다.

2학년 반별 교사 배정은 사용자가 제공한 8/24 참고 시간표를 사용합니다. 복수 담당 과목은 같은 과목·요일·교시가 확인되는 경우에만 연결하며, 단일 담당 과목은 반별 담당을 사용합니다. 아직 실명을 제공받지 않은 교사는 축약 이름으로 표시합니다.

3학년 교사명도 사용자 제공 8/24 참고 표를 사용합니다. 노란 변경 셀은 취소선 대신 변경된 과목으로 해석합니다. 복수 담당 수업은 과목·요일·교시가 맞는 경우에만 연결하고, 미확인 과목은 비워 둡니다. 3학년 염혜 표기는 사용자 제공 철자인 염헤린으로 표시합니다.


## Google 회원가입·로그인 설정

1. Google Cloud Console에서 프로젝트를 선택하고 Google Auth Platform의 Branding(앱 이름 `BSSM 시간표`, 지원 이메일)·Audience·Data Access를 설정합니다. 로그인에 필요한 범위는 `openid`, `email`, `profile`뿐입니다. 학교 조직 계정 프로젝트라면 Internal을 선택할 수 있습니다. External의 Testing 상태라면 사용할 학교 계정을 테스트 사용자로 등록합니다.
2. Clients에서 **웹 애플리케이션** OAuth 클라이언트를 만듭니다. 승인된 리디렉션 URI에 `http://127.0.0.1:5173/api/auth/callback`을 정확하게 등록합니다. 이 구현은 서버 리디렉션 방식이므로 승인된 JavaScript 원본은 필요하지 않습니다.
3. `.env.local`의 빈 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 발급받은 값을 저장합니다. 비밀키를 채팅·GitHub에 올리지 마세요. `GOOGLE_ALLOWED_DOMAINS=bssm.hs.kr`, `APP_ORIGIN=http://127.0.0.1:5173`을 유지합니다.
4. `npm run dev` 후 `http://127.0.0.1:5173/#/signup`에서 Google 계정을 선택합니다. Google 설정은 요청마다 읽기 때문에 값 저장 후 다시 확인할 수 있습니다. `localhost`와 `127.0.0.1`은 서로 다른 주소이므로 위 주소를 그대로 사용합니다.
5. 실제 가입 → 학년·반·번호 등록 → 새로고침 → 로그아웃 → 재로그인 순서로 확인합니다. 첫 로그인은 가입 처리되며, 재로그인하면 서버에 저장된 학생 정보를 복원합니다.

개발 서버와 preview는 인증 리디렉션을 일치시키기 위해 5173 포트만 사용합니다. 운영 서버는 `APP_ORIGIN`을 실제 HTTPS 주소로 바꾸고 Google 클라이언트에도 해당 주소의 `/api/auth/callback`을 추가해야 합니다. 로컬에서 `npm start`의 기본 3000 포트를 사용한다면 APP_ORIGIN과 등록된 리디렉션 URI도 3000으로 맞춥니다.

Google 비밀번호·액세스 토큰·리프레시 토큰은 저장하지 않습니다. 로그인에는 state·nonce·PKCE와 Google 공식 라이브러리의 ID 토큰 검증을 사용하며, 검증된 이메일과 Workspace hd 모두 학교 도메인과 일치해야 합니다. 세션 쿠키는 HttpOnly·SameSite=Lax이고 HTTPS에서는 Secure를 사용합니다. 세션은 7일 만료되며 로그아웃 시 폐기합니다. 프로필 저장·로그아웃은 동일 출처 요청만 허용합니다.

계정·학생 프로필과 해시된 세션은 `.data/auth.sqlite`에 저장합니다. 이 폴더와 `.env.local`은 Git 제외 대상입니다. 배포 시 `.data`를 보존할 영구 디스크가 필요합니다. 인증 시작 시 자동 생성되므로 비어 있는 개발 환경에서는 아직 파일이 없을 수 있습니다. 여러 서버 인스턴스로 배포하려면 공유 DB로 변경해야 합니다.

기존 시연용 브라우저 프로필은 인증된 계정으로 자동 이전하지 않습니다. 이동 교실·단축수업·알림 설정은 Google 계정별 브라우저 저장 영역으로 분리합니다. Google Cloud 프로젝트나 학교 관리자의 앱 허용 정책에 따라 관리자의 승인이 필요할 수 있습니다.


## 웹 푸시: 웹을 닫아도 받는 기기 알림

로그인과 학생 정보 등록 후 **알림 설정 → 이 기기 알림 켜기 → 브라우저 알림 허용 → 테스트 알림 보내기** 순서로 연결합니다. 기기·브라우저별로 한 번씩 허용하며, 다른 기기의 설정을 대신 켜지 않습니다. 화면 알림 토글은 페이지 안 알림에만 적용되고, 기기 알림은 별도 버튼으로 끕니다. 로그아웃하면 해당 로그인 세션의 구독을 삭제합니다. 7일 세션 만료 후에는 다시 로그인하고 기기 알림을 연결해야 합니다.

`WEB_PUSH_SUBJECT`에는 발신자 연락용 `mailto:학교이메일`을 설정합니다. VAPID 키는 최초 사용 시 `.data/web-push-keys.json`에 자동 생성되어 같은 키를 계속 사용합니다. 이 파일·계정 DB·.env.local은 Git 제외 대상이며 클라이언트에는 공개키만 전달합니다. 배포 및 재배포 시 `.data`를 보존하세요. 키를 잃거나 변경하면 기기에서 알림을 다시 연결해야 합니다.

Node 서버(또는 개발/preview 서버)의 스케줄러가 30초마다 한국 시간(Asia/Seoul) 기준으로 확인합니다. 나이스 실제 수업이 존재하고 시작까지 5분 이하일 때만 발송하며, 단축수업과 이동 교실 설정을 반영합니다. 이미 발송한 수업은 SQLite 기록으로 중복을 막고, 일시적 전송 실패는 수업 시작 전에 재시도합니다. 만료된 구독은 제거합니다. 나이스 조회 실패나 없는 수업을 예시 데이터로 대체하지 않습니다. 수업 시각은 앱의 기본 일과표(08:40 시작)를 사용하므로 실제 학교 일과와 일치해야 정확합니다.

현재 Mac에서 로컬 서버를 실행하는 동안은 탭을 닫아도 테스트할 수 있습니다. **컴퓨터나 서버를 종료하면 발송되지 않습니다.** 학생들이 매일 사용하려면 Node 24 상시 실행 서버, HTTPS 도메인, 영구 디스크를 준비하고 APP_ORIGIN·Google OAuth 리디렉션 주소를 배포 주소로 맞춰야 합니다. 정적 파일만 배포하거나 유휴 상태에서 잠드는 호스팅은 예약 발송에 적합하지 않습니다. 현재 단일 Node 인스턴스용입니다.

맥 Safari는 macOS Ventura 이후 웹을 닫은 상태의 Web Push를 지원합니다. Chrome은 백그라운드 실행 상태에 영향을 받습니다. 알림 배너·집중 모드·소리는 맥 시스템 설정을 따르며 웹 푸시에서 자체 알림음 파일을 재생하지 않습니다. 네트워크·브라우저·운영체제 상황에 따라 도착이 늦을 수 있어 정확한 분 단위 전달을 보장하지 않습니다. 늦게 수신한 메시지는 오래된 수업 안내 대신 최신 시간표 확인 메시지를 표시합니다.

브라우저 푸시 제공사에 암호화된 알림이 전달됩니다. 발송 대상 주소는 Google·Apple·Mozilla의 알려진 HTTPS 엔드포인트로 제한하며, 구독·해제·설정·테스트 요청은 로그인과 같은 출처를 확인합니다.


## GitHub에서 무료 Cloudflare 배포

무료 배포 경로는 Workers Static Assets + D1 + Cron Trigger입니다. Node 로컬 실행은 그대로 사용할 수 있고, Cloudflare는 `edge/worker.js`를 실행합니다. 비밀값이나 개인 DB 파일을 GitHub로 업로드하지 않습니다. 이 경로는 무료 플랜 한도 안에서 동작하며 무료 CPU/요청/DB 한도를 넘으면 요청이나 예약 실행이 제한됩니다. 자동 유료 업그레이드는 하지 않습니다. 학교 전체 사용 전에는 배포 로그와 사용량을 확인해야 합니다.

1. Cloudflare 무료 계정으로 로그인하고 GitHub의 `ahyeon1004/time_table` 저장소만 연결합니다.
2. Workers 프로젝트 이름은 `bssm-timetable`, 빌드 명령은 `npm ci && npm run build`, 초기 배포 명령은 `npx wrangler deploy`입니다. `wrangler.jsonc`에는 D1 `DB` 바인딩과 1분 예약 작업이 정의되어 있습니다. 첫 배포에서 DB를 만들거나 기존 DB를 연결하고 반환된 database_id를 설정 파일에 저장합니다.
3. `npm run edge:migrate:remote`로 DB 스키마를 적용합니다. 이후 자동 배포 명령은 `npm run edge:deploy`로 변경하여 마이그레이션 후 코드가 배포되게 합니다.
4. Worker 변수 APP_ORIGIN을 실제 `https://...workers.dev` 주소로 설정합니다. GOOGLE_ALLOWED_DOMAINS는 `bssm.hs.kr`입니다.
5. Worker Secrets에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEIS_API_KEY`, `WEB_PUSH_SUBJECT`, `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`를 등록합니다. VAPID 공개/비밀키는 로컬 `.data/web-push-keys.json`의 동일한 키 쌍을 사용하거나 배포 전 새로 생성한 쌍을 사용합니다. 비밀값은 콘솔의 암호화된 Secret 또는 `wrangler secret put`의 표준입력으로만 전달합니다. 배포 전에 해당 호스팅으로 비밀값을 저장할 사용자 승인을 확인합니다.
6. Google Cloud OAuth 클라이언트의 승인된 리디렉션 URI에 배포 주소의 `/api/auth/callback`을 추가합니다. 로컬 URI는 계속 보존합니다.
7. 공개 주소에서 가입, 학생 정보 저장, 로그아웃/재로그인, 실제 나이스 조회, 기기 알림 허용과 테스트 수신을 확인합니다. 로컬 계정 DB와 기기 구독을 업로드하지 않으므로 배포 사이트에서는 최초 한 번 다시 학생 정보를 등록하고 알림을 허용합니다. Google 계정 자체는 동일하게 사용할 수 있습니다.

로컬 Workers 검증: `.dev.vars.example`을 `.dev.vars`로 복사하고 로컬 비밀값을 채운 뒤 `npm run edge:migrate:local`, `npm run edge:dev`를 실행합니다. `.dev.vars`와 `.wrangler`는 Git 제외 대상입니다. `npm run edge:check`는 원격 배포 없이 번들만 검증합니다.

GitHub Actions의 `Check timetable`은 테스트와 배포 번들을 검증합니다. 실제 배포는 Cloudflare의 GitHub 연결에서 수행하므로 GitHub Actions에 Cloudflare 비밀 토큰을 추가할 필요가 없습니다. 각 서비스의 무료 사용량 및 권한 범위는 해당 계정에서 확인합니다.

## Vercel 배포

Vite 정적 화면과 `api/index.js`의 Node.js 24 API를 함께 배포합니다.
GitHub 저장소를 기존 `bssm-timetable` 프로젝트에 연결하고 Neon Free 데이터베이스를 Storage에서 연결하세요.
`DATABASE_URL`은 비공개 서버 환경변수이며 브라우저용 `VITE_` 접두어를 붙이지 않습니다.
`APP_ORIGIN`은 운영 URL, Google 승인 리디렉션 URI는 해당 URL의 `/api/auth/callback`으로 등록합니다.
기존 Google/나이스 환경변수 및 VAPID 키도 비공개 서버 환경변수에 등록합니다.
운영 DB 연결을 확인한 뒤 `npm run vercel:db:migrate`를 한 번 실행하세요.
마이그레이션은 테이블과 인덱스를 생성하며 기존 데이터를 삭제하지 않습니다. 로컬 SQLite 개인정보 DB는 업로드하지 않습니다.

Vercel Hobby의 자체 Cron은 하루 한 번만 가능하므로 수업 5분 전 알림 스케줄러로 사용할 수 없습니다.
별도의 분 단위 호출자가 연결되기 전에는 `PUSH_SCHEDULER_ENABLED=false`를 유지하며 UI에도 자동 알림 준비 중 상태를 표시합니다.
테스트 푸시는 기기 연결과 서버 키 등록 후 사용할 수 있습니다.
호출자를 마련한 뒤에만 `PUSH_SCHEDULER_ENABLED=true`로 설정합니다. 호출 경로는 `GET` 또는 `POST /api/push/dispatch`이며
`Authorization: Bearer <CRON_SECRET>`가 필수입니다. 비밀키를 URL 쿼리에 넣지 않습니다.
호출 실패·중복 발송 처리는 공통 푸시 서비스와 영구 DB의 발송 기록을 사용합니다.
