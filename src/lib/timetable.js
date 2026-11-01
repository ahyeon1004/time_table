import { isUnconfirmedTeacher } from "./thirdGradeTeachers.js";
import { dateKey, parseDate } from "./schedule.js";
import { lessonLabel, lessonTeacher } from "./lessonLabels.js";
const COLORS = [
  "blue",
  "mint",
  "yellow",
  "lavender",
  "pink",
  "cyan",
  "lime",
  "indigo",
  "peach",
];
export function subjectColor(name) {
  let hash = 0;
  for (const char of name)
    hash = (Math.imul(hash, 31) + char.codePointAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}
export function normalizeTimetable(payload, { grade, classroom, week }) {
  if (
    payload.source !== "NEIS" ||
    payload.grade !== String(grade) ||
    payload.classroom !== String(classroom) ||
    payload.from !== dateKey(week) ||
    !Array.isArray(payload.rows)
  )
    throw new Error("요청한 학급과 시간표 정보가 일치하지 않습니다.");
  const byDate = {};
  let maxPeriods = 7;
  for (const row of payload.rows) {
    const date = parseDate(row.date),
      day = (date.getDay() + 6) % 7;
    if (
      day >= 5 ||
      dateKey(date) !== row.date ||
      row.date < payload.from ||
      row.date > payload.to ||
      !Number.isInteger(row.period) ||
      row.period < 1 ||
      row.period > 20 ||
      typeof row.content !== "string" ||
      !row.content.trim()
    )
      throw new Error("시간표 데이터 형식을 확인할 수 없습니다.");
    const periods = (byDate[row.date] ??= []);
    const previous = periods[row.period - 1];
    const names = [
      ...new Set([...(previous?.subjects ?? []), row.content.trim()]),
    ];
    const sourceName = names.join(" / ");
    const displayNames = [
      ...new Set(
        names.map((subject) => lessonLabel(subject, grade, classroom)),
      ),
    ];
    const name = displayNames.join(" / ");
    const teachers = names.map((subject) =>
      lessonTeacher(lessonLabel(subject, grade, classroom), {
        sourceName: subject,
        grade,
        classroom,
        day,
        period: row.period,
      }),
    );
    const teacher = teachers.every(Boolean)
      ? [...new Set(teachers)].join(" / ")
      : null;
    periods[row.period - 1] = {
      name,
      sourceName,
      isChanged: names.some((subject) =>
        /\[(?:보강|변경|대체)\]/.test(subject),
      ),
      subjects: names,
      color: subjectColor(displayNames[0]),
      teacher,
      teacherSource: teacher ? "사용자 제공" : null,
      teacherUnconfirmed:
        Boolean(teacher) &&
        String(grade) === "3" &&
        names.some((subject) => isUnconfirmedTeacher(subject, classroom)),
      room: "",
      source: "NEIS",
    };
    maxPeriods = Math.max(maxPeriods, row.period);
  }
  return {
    byDate,
    maxPeriods,
    rowCount: payload.rows.length,
    fetchedAt: payload.fetchedAt,
    source: "NEIS",
  };
}
export function lessonFor(byDate, date, period) {
  return byDate?.[dateKey(date)]?.[period] ?? null;
}
