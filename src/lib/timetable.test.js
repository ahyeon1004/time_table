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
    "체육2",
  );
  assert.equal(lessonFor(normalized.byDate, new Date(2026, 9, 26), 1), null);
  assert.equal(lessonFor(normalized.byDate, new Date(2026, 9, 28), 0), null);
  assert.equal(
    lessonFor(normalized.byDate, new Date(2026, 9, 27), 2).teacher,
    null,
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
