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
- 교사명과 실제 이동 교실은 나이스 시간표 응답에 포함되지 않습니다. 교사명은 ‘교사 정보 미제공’으로 표시하며 이동 교실은 사용자가 설정합니다.
- 동일 교시의 여러 선택과목은 함께 표시합니다. 비어 있는 교시·휴업일·미공개 주간은 임의 과목으로 채우지 않습니다.
- 과목 데이터만 실제 연동됩니다. 수업 시작·종료 시각은 기존 기본 설정(08:40 시작, 수업 50분, 쉬는 시간 10분, 4교시 뒤 점심 50분)입니다. 실제 학교 일과표와 일치하는지 확인해야 하며, 단축수업은 날짜별 설정으로 반영됩니다.
- 나이스 공개 자료가 학교의 당일 변경 시간표보다 늦게 갱신될 수 있습니다.

## 실행과 배포

Node.js 22.12 이상 또는 24 LTS를 권장합니다.

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

Google OAuth는 아직 시연 흐름입니다. 학교 이메일 도메인은 임의로 지정하지 않았습니다. 알림은 페이지 안에서 표시하며, 브라우저가 닫힌 상태의 푸시 알림은 구현하지 않았습니다.

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
