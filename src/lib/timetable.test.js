import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTimetable, lessonFor, subjectColor } from "./timetable.js";

const query = { grade: "1", classroom: "2", week: new Date(2026, 9, 26) };
const payload = (rows) => ({
  source: "NEIS",
  grade: "1",
  classroom: "2",
  from: "2026-10-26",
  to: "2026-10-30",
  rows,
  fetchedAt: "2026-11-01T00:00:00Z",
});
test("날짜·교시로 배치하고 조회에 없는 교시를 임의 수업으로 채우지 않는다", () => {
  const normalized = normalizeTimetable(
    payload([
      { date: "2026-10-26", period: 1, content: "체육2" },
      { date: "2026-10-27", period: 3, content: "알고리즘 설계" },
    ]),
    query,
  );
  assert.equal(
    lessonFor(normalized.byDate, new Date(2026, 9, 26), 0).name,
    "체육",
  );
  assert.equal(lessonFor(normalized.byDate, new Date(2026, 9, 26), 1), null);
  assert.equal(lessonFor(normalized.byDate, new Date(2026, 9, 28), 0), null);
  assert.equal(
    lessonFor(normalized.byDate, new Date(2026, 9, 27), 2).teacher,
    "염혜린",
  );
});
test("동일 교시의 선택과목은 중복 제거 후 함께 표시하고 8교시를 보존한다", () => {
  const rows = ["인공지능 기초", "인공지능 기초", "데이터베이스"].map(
    (content) => ({ date: "2026-10-26", period: 8, content }),
  );
  const normalized = normalizeTimetable(payload(rows), query);
  assert.equal(normalized.maxPeriods, 8);
  assert.equal(
    normalized.byDate["2026-10-26"][7].name,
    "인공지능 기초 / 데이터베이스",
  );
});
test("다른 반의 응답과 잘못된 날짜를 거부한다", () => {
  assert.throws(() =>
    normalizeTimetable({ ...payload([]), classroom: "3" }, query),
  );
  assert.throws(() =>
    normalizeTimetable(
      payload([{ date: "2026-10-32", period: 1, content: "국어" }]),
      query,
    ),
  );
});
test("빈 주간은 성공한 빈 결과이고 색상은 주간과 무관하게 유지된다", () => {
  assert.equal(normalizeTimetable(payload([]), query).rowCount, 0);
  assert.equal(subjectColor("알고리즘 설계"), subjectColor("알고리즘 설계"));
});

test("1학년 모든 반·요일·교시에만 운영체제 표시명을 적용하고 원본을 보존한다", () => {
  const rows = [
    { date: "2026-10-26", period: 1, content: "* 개발자 환경 구축" },
    { date: "2026-10-28", period: 5, content: "* IT시스템 서버 운영관리" },
    { date: "2026-10-29", period: 4, content: "IT시스템 서버 운영 관리" },
    { date: "2026-10-30", period: 2, content: "체육2" },
  ];
  for (const grade of ["1", "2", "3"]) {
    for (const classroom of ["1", "2", "3", "4"]) {
      const result = normalizeTimetable(
        { ...payload(rows), grade, classroom },
        { ...query, grade, classroom },
      );
      for (const row of rows) {
        const lesson = result.byDate[row.date][row.period - 1];
        const expected =
          grade === "1"
            ? row.content === "체육2"
              ? "체육"
              : "운영체제"
            : grade === "2" && row.content === "* 개발자 환경 구축"
              ? "운영체제"
              : row.content;
        assert.equal(lesson.name, expected, `${grade}학년 ${classroom}반`);
        assert.equal(lesson.sourceName, row.content);
        assert.deepEqual(lesson.subjects, [row.content]);
        assert.equal(lesson.color, subjectColor(expected));
      }
    }
  }
});

test("같은 교시에 두 운영체제 원본 과목이 있어도 표시명은 중복하지 않는다", () => {
  const rows = ["* 개발자 환경 구축", "* IT시스템 서버 운영관리"].map(
    (content) => ({ date: "2026-10-26", period: 1, content }),
  );
  const lesson = normalizeTimetable(payload(rows), query).byDate[
    "2026-10-26"
  ][0];
  assert.equal(lesson.name, "운영체제");
  assert.equal(lesson.subjects.length, 2);
});

test("1학년 교사명과 간결한 과목명을 연결하되 2·3학년은 유지한다", () => {
  const entries = [
    ["공통수학2", "공통수학", "김규봉"],
    ["공통영어2", "공통영어", "이경숙"],
    ["통합과학2", "통합과학", "최한영"],
    ["통합사회2", "통합사회", "허혜진"],
    ["진로 활동", "진로 활동", "김나영"],
    ["인공지능 일반", "인공지능", "송지훈"],
    ["사물 인터넷 센서 제어", "IoT", "이진열"],
    ["사물 인터넷과 센서 제어", "IoT", "이진열"],
    ["디자인 일반", "디자인", "정유진"],
    ["* IT시스템 서버 운영관리", "운영체제", "김현지"],
    ["체육 2", "체육", "설동상"],
  ];
  for (const [content, label, teacher] of entries) {
    for (const grade of ["1", "3"]) {
      const rows = [{ date: "2026-10-26", period: 1, content }];
      const lesson = normalizeTimetable(
        { ...payload(rows), grade },
        { ...query, grade },
      ).byDate["2026-10-26"][0];
      assert.equal(lesson.name, grade === "1" ? label : content);
      assert.equal(
        lesson.teacher,
        grade === "1" ? teacher : content === "진로 활동" ? "박근" : null,
      );
      assert.equal(lesson.sourceName, content);
    }
  }
});

test("알고리즘 교사명은 제공된 1학년 1반 요일·교시에만 연결한다", () => {
  const slots = [
    ["2026-10-26", 2, "염혜린"],
    ["2026-10-26", 3, "염혜린"],
    ["2026-10-30", 4, "염혜린"],
    ["2026-10-29", 7, "김미영"],
    ["2026-10-27", 2, null],
  ];
  for (const classroom of ["1", "5"]) {
    const rows = slots.map(([date, period]) => ({
      date,
      period,
      content: "알고리즘 설계",
    }));
    const result = normalizeTimetable(
      { ...payload(rows), classroom },
      { ...query, classroom },
    );
    for (const [date, period, teacher] of slots) {
      assert.equal(result.byDate[date][period - 1].name, "알고리즘");
      assert.equal(
        result.byDate[date][period - 1].teacher,
        classroom === "1" ? teacher : null,
      );
    }
  }
});

test("1학년 2·3·4반 알고리즘 담당은 반별 예외 교시에만 김미영이고 나머지는 염혜린이다", () => {
  for (const grade of ["1", "2", "3"]) {
    for (const classroom of ["2", "3", "4"]) {
      const rows = [];
      for (let day = 0; day < 5; day++) {
        for (let period = 1; period <= 7; period++) {
          rows.push({
            date: `2026-10-${26 + day}`,
            period,
            content: "알고리즘 설계",
          });
        }
      }
      const result = normalizeTimetable(
        { ...payload(rows), grade, classroom },
        { ...query, grade, classroom },
      );
      for (let day = 0; day < 5; day++) {
        for (let period = 1; period <= 7; period++) {
          const kim =
            (classroom === "2" && day === 3 && period === 4) ||
            (classroom === "3" && day === 0) ||
            (classroom === "4" && day === 4 && period === 1);
          assert.equal(
            result.byDate[`2026-10-${26 + day}`][period - 1].teacher,
            grade === "1" ? (kim ? "김미영" : "염혜린") : null,
            `${grade}학년 ${classroom}반 요일${day} ${period}교시`,
          );
        }
      }
    }
  }
});

test("2학년 전체 반의 표시명과 원본을 보존하며 3학년은 변경하지 않는다", () => {
  for (const grade of ["2", "3"]) {
    for (const classroom of ["1", "2", "3", "4"]) {
      const rows = [{ date: "2026-10-26", period: 1, content: "* SQL활용" }];
      const lesson = normalizeTimetable(
        { ...payload(rows), grade, classroom },
        { ...query, grade, classroom },
      ).byDate["2026-10-26"][0];
      assert.equal(lesson.name, grade === "2" ? "데이터 베이스" : "* SQL활용");
      assert.equal(lesson.sourceName, "* SQL활용");
      if (grade === "3") assert.equal(lesson.teacher, null);
    }
  }
});

test("사용자 표의 반별 담당과 다중 담당 과목을 구분해 실명으로 표시한다", () => {
  const cases = [
    ["1", "2026-10-26", 2, "* SQL활용", "박지혜"],
    ["3", "2026-10-27", 3, "세계 문화와 영어", "차수민"],
    ["4", "2026-10-26", 1, "* 펌웨어 구현", "이세준"],
    ["4", "2026-10-26", 2, "* 펌웨어 구현", "이세준"],
    ["4", "2026-10-26", 3, "* 펌웨어 구현", "이세준"],
    ["4", "2026-10-27", 1, "펌웨어 구현", null],
    ["3", "2026-10-26", 1, "펌웨어 구현", null],
    ["3", "2026-10-26", 5, "* 인공지능 플랫폼 요구사항 분석", "최병준"],
    ["3", "2026-10-27", 6, "인공지능 플랫폼 요구사항 분석", "최병준"],
    ["2", "2026-10-26", 5, "인공지능 플랫폼 요구사항 분석", null],
    ["2", "2026-10-26", 5, "* 인공지능 모델학습", "조유진"],
    ["2", "2026-10-26", 6, "인공지능 모델 학습", "조유진"],
    ["2", "2026-10-27", 5, "인공지능 모델학습", null],
    ["1", "2026-10-26", 5, "인공지능 모델학습", null],
    ["2", "2026-10-26", 4, "* SQL활용", "박제현"],
    ["2", "2026-10-26", 4, "공통국어2", "진예빈"],
    ["1", "2026-10-26", 1, "* SQL활용", "박지혜"],
    ["1", "2026-10-30", 4, "* SQL활용", "박제현"],
    ["1", "2026-10-26", 2, "공통국어2", "진예빈"],
    ["1", "2026-10-29", 6, "공통국어2", "김수"],
    ["1", "2026-10-29", 7, "세계 문화와 영어", "차수민"],
    ["1", "2026-10-30", 1, "세계 문화와 영어", "필립"],
    ["1", "2026-10-26", 3, "한국사2", "이혜정"],
    ["1", "2026-10-26", 4, "대수", "전지영"],
    ["1", "2026-10-27", 1, "* 개발자 환경 구축", "김현지"],
    ["1", "2026-10-27", 4, "스포츠 생활2", "설동상"],
    ["1", "2026-10-28", 4, "컴퓨터 네트워크", "박건우"],
    ["3", "2026-10-28", 3, "컴퓨터 네트워크", "이나영"],
    ["1", "2026-10-29", 3, "* 인공지능 모델 선정", "박수진"],
    ["2", "2026-10-29", 2, "* 인공지능 모델 선정", "박지혜"],
    ["2", "2026-10-26", 5, "* 인공지능서비스 애플리케이션 개발", "조유진"],
    ["1", "2026-10-26", 5, "* 인공지능서비스 애플리케이션 개발", "안정"],
    ["3", "2026-10-26", 5, "* 인공지능 플랫폼 인프라 구현", "최병준"],
    ["4", "2026-10-26", 5, "* 임베디드 SW 아키텍처 설계", "이세준"],
    ["1", "2026-10-29", 2, "진로활동", "박근"],
    ["1", "2026-10-28", 7, "공통국어2", null],
  ];
  for (const [classroom, date, period, content, teacher] of cases) {
    const rows = [{ date, period, content }];
    const lesson = normalizeTimetable(
      { ...payload(rows), grade: "2", classroom },
      { ...query, grade: "2", classroom },
    ).byDate[date][period - 1];
    assert.equal(
      lesson.teacher,
      teacher,
      `${classroom}반 ${date} ${period}교시 ${content}`,
    );
    assert.equal(lesson.sourceName, content);
  }
});

test("3학년은 제공된 반별 담당 실명을 연결하고 복수 담당 인공지능 프로그래밍을 구분한다", () => {
  const cases = [
    ["1", "2026-10-26", 1, "* UI 테스트", "김현지"],
    ["1", "2026-10-26", 5, "모바일 프로그래밍", "김미영"],
    ["1", "2026-10-27", 1, "* 모의해킹", "최병준"],
    ["1", "2026-10-28", 1, "웹 프로그래밍 실무", "박수진"],
    ["1", "2026-10-28", 4, "인공지능 프로그래밍", "박소영"],
    ["1", "2026-10-29", 2, "인공지능 프로그래밍", "안정"],
    ["1", "2026-10-27", 7, "인공지능 프로그래밍", null],
    ["1", "2026-10-29", 1, "스포츠 생활", "설동상"],
    ["1", "2026-10-26", 4, "진로활동", "박근"],
    ["2", "2026-10-26", 1, "창업 일반", "이나영"],
    ["2", "2026-10-26", 5, "* UI 테스트", "송지훈"],
    ["2", "2026-10-29", 1, "서버 구축 및 운영", "염헤린"],
    ["3", "2026-10-26", 2, "리눅스 시스템 프로그래밍", "정희철"],
    ["3", "2026-10-26", 5, "* 로봇 센서 인터페이스 개발", "박제현"],
    ["3", "2026-10-27", 4, "임베디드 시스템", "장현정"],
    ["3", "2026-10-28", 4, "[보강]서버 구축 및 운영", "조유진"],
    ["4", "2026-10-26", 4, "창업 일반", "정유진"],
    ["4", "2026-10-27", 1, "* 애플리케이션 배포", "이세준"],
    ["4", "2026-10-29", 1, "자동화 설비", "이진열"],
    ["1", "2026-10-27", 1, "* 프로그래밍 언어 응용", "최병준"],
    ["1", "2026-10-27", 4, "* 애플리케이션 배포", "김미영"],
    ["2", "2026-10-27", 1, "* 프로그래밍 언어 응용", "이나영"],
    ["3", "2026-10-29", 1, "* 애플리케이션 배포", "장현정"],
  ];
  for (const [classroom, date, period, content, teacher] of cases) {
    const rows = [{ date, period, content }];
    const lesson = normalizeTimetable(
      { ...payload(rows), grade: "3", classroom },
      { ...query, grade: "3", classroom },
    ).byDate[date][period - 1];
    assert.equal(lesson.teacher, teacher, `${classroom}반 ${date} ${content}`);
    assert.equal(
      lesson.name,
      content.replace(/\[(?:보강|변경|대체)\]\s*/g, "").trim(),
    );
    assert.equal(lesson.sourceName, content);
  }
});

test("3학년 4반 로봇 보강 담당은 사용자 추정으로 표시하고 일반 수업은 유지한다", () => {
  for (const [classroom, content, expected, unconfirmed] of [
    ["4", "[보강]* 로봇 센서 인터페이스 개발", "이세준", true],
    ["4", "* 로봇 센서 인터페이스 개발", "박제현", false],
    ["3", "[보강]* 로봇 센서 인터페이스 개발", "박제현", false],
  ]) {
    const rows = [{ date: "2026-10-28", period: 3, content }];
    const lesson = normalizeTimetable(
      { ...payload(rows), grade: "3", classroom },
      { ...query, grade: "3", classroom },
    ).byDate["2026-10-28"][2];
    assert.equal(lesson.teacher, expected);
    assert.equal(lesson.teacherUnconfirmed, unconfirmed);
  }
});

test("전체 학년의 변경 표시를 강조 상태로 보존하고 화면 과목명에서는 제거한다", () => {
  for (const grade of ["1", "2", "3"]) {
    for (const marker of ["보강", "변경", "대체"]) {
      const content = `[${marker}]공통수학2`;
      const rows = [{ date: "2026-10-26", period: 1, content }];
      const lesson = normalizeTimetable(
        { ...payload(rows), grade },
        { ...query, grade },
      ).byDate["2026-10-26"][0];
      assert.equal(lesson.isChanged, true);
      assert.equal(lesson.name, grade === "1" ? "공통수학" : "공통수학2");
      assert.equal(lesson.sourceName, content);
      assert.equal(lesson.teacher, grade === "1" ? "김규봉" : null);
    }
  }
  const normal = normalizeTimetable(
    payload([{ date: "2026-10-26", period: 1, content: "공통수학2" }]),
    query,
  );
  assert.equal(normal.byDate["2026-10-26"][0].isChanged, false);
});
