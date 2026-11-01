import test from "node:test";
import assert from "node:assert/strict";
import {
  createSchedule,
  mondayOf,
  dateKey,
  lessonAt,
  nextLesson,
  movementFor,
} from "./schedule.js";

const math = { name: "수학", teacher: null, color: "mint" };
const timetable = Object.fromEntries(
  ["2026-11-02", "2026-11-03"].map((date) => [
    date,
    Array.from({ length: 7 }, () => math),
  ]),
);

test("기본 시간표와 점심시간은 4교시 이후 이어진다", () => {
  const s = createSchedule();
  assert.deepEqual(s.periods[0], { period: 1, start: 520, end: 570 });
  assert.deepEqual(s.lunch, { start: 750, end: 800 });
  assert.equal(s.periods[4].start, s.lunch.end);
  assert.equal(s.periods[6].end, 970);
});
test("하루 10분 단축과 45분 점심의 미리보기", () => {
  const s = createSchedule({ session: "all", reduction: 10, lunch: 45 });
  assert.deepEqual(s.lunch, { start: 710, end: 755 });
  assert.equal(s.periods[6].end, 895);
});
test("오후 단축은 오전 수업 시간을 변경하지 않는다", () => {
  const normal = createSchedule();
  const changed = createSchedule({
    session: "afternoon",
    reduction: 5,
    lunch: 50,
  });
  assert.deepEqual(changed.periods.slice(0, 4), normal.periods.slice(0, 4));
  assert.equal(changed.periods[4].end - changed.periods[4].start, 45);
});
test("일요일은 다음 등교 주간을 기본으로 선택한다", () => {
  assert.equal(dateKey(mondayOf(new Date(2026, 10, 1), true)), "2026-11-02");
});
test("현재 교시는 시작을 포함하고 종료를 포함하지 않는다", () => {
  assert.equal(
    lessonAt(new Date(2026, 10, 3, 10, 40), {}, timetable).period,
    2,
  );
  assert.equal(lessonAt(new Date(2026, 10, 3, 11, 30), {}, timetable), null);
  assert.equal(lessonAt(new Date(2026, 10, 1, 10, 50), {}, timetable), null);
});
test("다음 수업은 주말을 건너뛰고 단축수업을 반영한다", () => {
  assert.equal(
    dateKey(nextLesson(new Date(2026, 9, 30, 17), {}, timetable).date),
    "2026-11-02",
  );
  const next = nextLesson(
    new Date(2026, 10, 3, 9, 25),
    {
      "2026-11-03": { session: "all", reduction: 10, lunch: 45 },
    },
    timetable,
  );
  assert.equal(next.period, 1);
  assert.equal(next.start.getHours(), 9);
  assert.equal(next.start.getMinutes(), 30);
});
test("날짜별 이동 수업이 매주 반복 설정보다 우선하며 반별로 분리된다", () => {
  const p = { grade: "1", classroom: "1" };
  const data = {
    recurring: {
      "1-1:0:3": {
        enabled: true,
        room: "실습실",
        scope: "weekly",
        subjectName: "수학",
      },
    },
    dates: {
      "1-1:2026-11-02:3": {
        enabled: false,
        room: "",
        scope: "date",
        subjectName: "수학",
      },
    },
  };
  assert.equal(
    movementFor(data, p, 0, 3, new Date(2026, 10, 2), math).enabled,
    false,
  );
  assert.equal(
    movementFor(data, p, 0, 3, new Date(2026, 10, 9), math).room,
    "실습실",
  );
  assert.equal(
    movementFor(
      data,
      { grade: "2", classroom: "1" },
      0,
      3,
      new Date(2026, 10, 9),
      math,
    ).room,
    "",
  );
});

test("실제 수업이 없는 교시나 휴업일에는 현재/다음 수업을 만들지 않는다", () => {
  assert.equal(lessonAt(new Date(2026, 10, 3, 10, 40), {}, {}), null);
  assert.equal(nextLesson(new Date(2026, 10, 3), {}, {}), null);
  const sparse = { "2026-11-03": [math, null, null, math] };
  assert.equal(lessonAt(new Date(2026, 10, 3, 10, 40), {}, sparse), null);
  assert.equal(nextLesson(new Date(2026, 10, 3, 10, 40), {}, sparse).period, 3);
});
test("같은 요일·교시라도 과목이 바뀌면 이전 이동 교실을 적용하지 않는다", () => {
  const movement = {
    recurring: {
      "1-1:0:3": {
        enabled: true,
        room: "실습실",
        scope: "weekly",
        subjectName: "프로그래밍",
      },
    },
    dates: {},
  };
  assert.equal(
    movementFor(
      movement,
      { grade: "1", classroom: "1" },
      0,
      3,
      new Date(2026, 10, 2),
      math,
    ).enabled,
    false,
  );
});
