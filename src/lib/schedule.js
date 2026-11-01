export const WEEKDAYS = ["월요일", "화요일", "수요일", "목요일", "금요일"];
export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseDate(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}
export function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}
export function mondayOf(date, nextOnWeekend = false) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const weekday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - weekday + (nextOnWeekend && weekday >= 5 ? 7 : 0));
  return d;
}
export function timeLabel(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function createSchedule(setting = null, periodCount = 7) {
  let cursor = 8 * 60 + 40;
  let lunch = null;
  const periods = Array.from({ length: periodCount }, (_, i) => {
    const shorten =
      setting &&
      (setting.session === "all" ||
        (setting.session === "morning" && i < 4) ||
        (setting.session === "afternoon" && i >= 4));
    const duration = 50 - (shorten ? Number(setting.reduction) : 0);
    const period = { period: i + 1, start: cursor, end: cursor + duration };
    cursor = period.end;
    if (i === 3) {
      lunch = {
        start: cursor,
        end: cursor + (setting ? Number(setting.lunch) : 50),
      };
      cursor = lunch.end;
    } else if (i < periodCount - 1) cursor += 10;
    return period;
  });
  return { periods, lunch };
}
export function movementFor(
  movements,
  profile,
  day,
  period,
  date,
  subject = null,
) {
  const classKey = `${profile.grade}-${profile.classroom}`;
  const exact = movements.dates?.[`${classKey}:${dateKey(date)}:${period}`];
  const recurring = movements.recurring?.[`${classKey}:${day}:${period}`];
  for (const record of [exact, recurring]) {
    if (subject && record?.subjectName === subject.name) return record;
  }
  return { enabled: false, room: "", scope: "weekly" };
}
export function lessonAt(now, shortSettings = {}, timetable = {}) {
  const day = (now.getDay() + 6) % 7;
  const lessons = timetable[dateKey(now)];
  if (day >= 5 || !lessons) return null;
  const schedule = createSchedule(
    shortSettings[dateKey(now)],
    Math.max(7, lessons.length),
  );
  const minutes = now.getHours() * 60 + now.getMinutes();
  const period = schedule.periods.findIndex(
    (slot) => minutes >= slot.start && minutes < slot.end,
  );
  const subject = lessons[period];
  return period < 0 || !subject
    ? null
    : { day, period, slot: schedule.periods[period], subject };
}
export function nextLesson(now, shortSettings = {}, timetable = {}) {
  for (let offset = 0; offset < 8; offset++) {
    const date = addDays(now, offset);
    const day = (date.getDay() + 6) % 7;
    const lessons = timetable[dateKey(date)];
    if (day >= 5 || !lessons) continue;
    const schedule = createSchedule(
      shortSettings[dateKey(date)],
      Math.max(7, lessons.length),
    );
    for (let period = 0; period < lessons.length; period++) {
      const subject = lessons[period];
      if (!subject) continue;
      const start = new Date(date);
      start.setHours(
        Math.floor(schedule.periods[period].start / 60),
        schedule.periods[period].start % 60,
        0,
        0,
      );
      if (start > now)
        return {
          day,
          date,
          period,
          start,
          subject,
          slot: schedule.periods[period],
        };
    }
  }
  return null;
}
export function calendarDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}
