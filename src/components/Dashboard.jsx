import { useEffect, useState } from "react";
import {
  ArrowsClockwise,
  WarningCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  Clock,
  GearSix,
  GraduationCap,
  Info,
  MapPin,
  SignOut,
  SlidersHorizontal,
  Sparkle,
} from "@phosphor-icons/react";
import { lessonFor } from "../lib/timetable.js";
import { Brand, Button } from "./ui.jsx";
import {
  addDays,
  calendarDays,
  createSchedule,
  dateKey,
  lessonAt,
  mondayOf,
  movementFor,
  nextLesson,
  timeLabel,
  WEEKDAYS,
} from "../lib/schedule.js";

function MiniCalendar({ month, setMonth, week, setWeek, today }) {
  const days = calendarDays(month);
  return (
    <section className="mini-calendar" aria-label="월간 달력">
      <header>
        <h2>
          {month.getFullYear()}년 {month.getMonth() + 1}월
        </h2>
        <div>
          <button
            className="icon-btn"
            aria-label="이전 달"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <CaretLeft size={14} />
          </button>
          <button
            className="icon-btn"
            aria-label="다음 달"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <CaretRight size={14} />
          </button>
        </div>
      </header>
      <div className="calendar-weekdays">
        {["월", "화", "수", "목", "금", "토", "일"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((date) => {
          const key = dateKey(date),
            day = (date.getDay() + 6) % 7;
          const selected = dateKey(mondayOf(date)) === dateKey(week) && day < 5;
          return (
            <button
              key={key}
              className={`${date.getMonth() !== month.getMonth() ? "outside-month" : ""} ${selected ? "selected-week" : ""} ${key === dateKey(today) ? "calendar-today" : ""}`}
              aria-label={`${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 주간 보기`}
              aria-current={key === dateKey(today) ? "date" : undefined}
              aria-pressed={selected}
              onClick={() => setWeek(mondayOf(date))}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </section>
  );
}
export default function Dashboard({
  profile,
  week,
  setWeek,
  now,
  shortSettings,
  movements,
  onOpen,
  navigate,
  onSignOut,
  previewTime,
  onTogglePreview,
  timetable,
  currentLessons,
  liveStatus,
}) {
  const [month, setMonth] = useState(
    new Date(week.getFullYear(), week.getMonth(), 1),
  );
  useEffect(
    () => setMonth(new Date(week.getFullYear(), week.getMonth(), 1)),
    [week],
  );
  const active = lessonAt(now, shortSettings, currentLessons);
  const next = nextLesson(now, shortSettings, currentLessons);
  const dates = Array.from({ length: 5 }, (_, index) => addDays(week, index));
  const standard = createSchedule(null, timetable.maxPeriods);
  const isCurrentWeek = dateKey(mondayOf(now)) === dateKey(week);
  const end = dates[4];
  function changeWeek(nextWeek) {
    setWeek(nextWeek);
    setMonth(new Date(nextWeek.getFullYear(), nextWeek.getMonth(), 1));
  }
  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-top">
          <button
            className="sidebar-brand"
            onClick={() => navigate("/")}
            aria-label="첫 화면"
          >
            <Brand />
          </button>
          <p>부산소프트웨어마이스터고등학교</p>
        </div>
        <div className="sidebar-body">
          <MiniCalendar
            month={month}
            setMonth={setMonth}
            week={week}
            setWeek={changeWeek}
            today={now}
          />
          <div className="week-navigation">
            <button onClick={() => changeWeek(addDays(week, -7))}>
              <CaretLeft size={15} />
              이전 주
            </button>
            <button onClick={() => changeWeek(addDays(week, 7))}>
              다음 주<CaretRight size={15} />
            </button>
          </div>
          <button
            className="today-button"
            onClick={() => changeWeek(mondayOf(now, true))}
          >
            <CalendarBlank size={17} />
            오늘로 이동
          </button>
          <div className="sidebar-separator" />
          <p className="nav-label">나의 시간표</p>
          <nav className="sidebar-nav" aria-label="시간표 설정">
            <button onClick={() => onOpen("picker")}>
              <MapPin />
              수업 및 이동 교실 설정
              <CaretRight size={13} />
            </button>
            <button onClick={() => onOpen("short")}>
              <Clock />
              단축수업 설정
              <CaretRight size={13} />
            </button>
            <button onClick={() => navigate("/notifications")}>
              <Bell />
              알림 설정
              <CaretRight size={13} />
            </button>
          </nav>
          <div className="sidebar-note">
            <span className="small-blue-dot" />
            <p>
              학교에서의 하루를
              <br />
              한눈에 확인해 보세요.
            </p>
          </div>
        </div>
        <div className="sidebar-profile">
          <span className="profile-avatar">
            <GraduationCap size={21} />
          </span>
          <div>
            <strong>
              {profile.grade}학년 {profile.classroom}반
            </strong>
            <span>{profile.number}번 · 학교 계정</span>
          </div>
          <button
            className="icon-btn"
            aria-label="로그아웃"
            title="로그아웃"
            onClick={onSignOut}
          >
            <SignOut size={18} />
          </button>
        </div>
      </aside>
      <main className="timetable-main">
        <header className="dashboard-header">
          <div>
            <div className="heading-label">
              <span className="small-blue-line" />
              나의 한 주
            </div>
            <h1>주간 시간표</h1>
            <p>
              {profile.grade}학년 {profile.classroom}반<span />
              매일의 수업을 가볍게 확인해요.
              <button
                className="class-change"
                onClick={() => navigate("/profile")}
              >
                학급 변경
              </button>
            </p>
          </div>
          <div className="week-title">
            <span>{week.getFullYear()}</span>
            <strong>
              {week.getMonth() + 1}월 {week.getDate()}일 <span>–</span>{" "}
              {week.getMonth() === end.getMonth()
                ? ""
                : `${end.getMonth() + 1}월 `}
              {end.getDate()}일
            </strong>
            <span className="week-source">나이스 시간표</span>
          </div>
        </header>
        <section
          className={`current-banner ${active ? "is-in-class" : ""}`}
          aria-label="현재 수업 안내"
        >
          <div className="banner-primary">
            <span className="status-orb">
              <Clock size={18} />
            </span>
            {active ? (
              <>
                <span className="current-label">
                  현재 {active.period + 1}교시
                </span>
                <strong>{active.subject.name}</strong>
                <span className="current-time">
                  {timeLabel(active.slot.start)} – {timeLabel(active.slot.end)}
                </span>
                <span className="live-mark">
                  <i />
                  수업 중
                </span>
              </>
            ) : (
              <>
                <strong>
                  {liveStatus === "loading"
                    ? "학교 시간표를 확인하고 있어요"
                    : liveStatus === "error"
                      ? "시간표 연결 상태를 확인해 주세요"
                      : "지금은 수업 시간이 아니에요"}
                </strong>
                <span className="current-time">
                  과목은 나이스 자료 · 수업 시각은 기본 설정
                </span>
              </>
            )}
          </div>
          {next && (
            <div className="next-class">
              다음 수업<span>{next.subject.name}</span>
              <ArrowRight size={15} />
            </div>
          )}
        </section>
        <div className="timetable-data-controls">
          <span role="status">
            {timetable.status === "loading"
              ? "시간표 불러오는 중…"
              : timetable.status === "error"
                ? "시간표 조회 실패"
                : `나이스 연동 · ${timetable.rowCount}건${timetable.fetchedAt ? " · " + new Date(timetable.fetchedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) + " 조회" : ""}`}
          </span>
          <button
            onClick={timetable.refresh}
            disabled={timetable.status === "loading"}
          >
            <ArrowsClockwise size={14} />
            새로고침
          </button>
        </div>
        {timetable.status === "error" && (
          <section className="timetable-message" role="alert">
            <WarningCircle size={21} />
            <div>
              <strong>
                {timetable.error?.code === "NEIS_KEY_MISSING"
                  ? "학교 시간표 연결 설정이 필요해요"
                  : "시간표를 불러오지 못했어요"}
              </strong>
              <p>{timetable.error?.message}</p>
            </div>
          </section>
        )}
        {timetable.status === "ready" && timetable.rowCount === 0 && (
          <section className="timetable-message empty">
            <CalendarBlank size={21} />
            <div>
              <strong>등록된 수업이 없는 주간이에요</strong>
              <p>
                방학·휴업일이거나 학교에서 아직 시간표를 공개하지 않았을 수
                있어요.
              </p>
            </div>
          </section>
        )}
        <div
          className="timetable"
          role="table"
          aria-label="월요일부터 금요일까지 주간 시간표"
        >
          <div className="timetable-head" role="row">
            <span className="period-column-label" role="columnheader">
              교시
            </span>
            {dates.map((date, index) => {
              const today = dateKey(date) === dateKey(now),
                setting = shortSettings[dateKey(date)];
              return (
                <div
                  key={index}
                  className={`day-heading ${today ? "is-today" : ""}`}
                  role="columnheader"
                >
                  <span>
                    {WEEKDAYS[index]}
                    <strong>{date.getDate()}</strong>
                  </span>
                  {today && <i>오늘</i>}
                  {setting && (
                    <span className="short-day-label">
                      {setting.reduction}분 단축
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="timetable-body" role="rowgroup">
            {Array.from({ length: timetable.maxPeriods }, (_, period) => (
              <div key={period} className="period-group">
                {period === 4 && (
                  <div className="lunch-row" role="row">
                    <span className="lunch-label" role="rowheader">
                      점심
                    </span>
                    <div className="lunch-times">
                      {dates.map((date) => {
                        const { lunch } = createSchedule(
                          shortSettings[dateKey(date)],
                        );
                        return (
                          <span key={dateKey(date)} role="cell">
                            <strong>
                              {timeLabel(lunch.start)} – {timeLabel(lunch.end)}
                            </strong>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="timetable-row" role="row">
                  <div className="period-label" role="rowheader">
                    <strong>
                      {period + 1}
                      <span>교시</span>
                    </strong>
                    <span>{timeLabel(standard.periods[period].start)}</span>
                  </div>
                  {dates.map((date, day) => {
                    const subject = lessonFor(timetable.byDate, date, period);
                    if (!subject)
                      return (
                        <div role="cell" key={day}>
                          <div
                            className={`lesson-empty ${timetable.status === "loading" ? "is-loading" : ""}`}
                            aria-label={`${WEEKDAYS[day]} ${period + 1}교시 ${timetable.status === "ready" ? "수업 없음" : "조회 대기"}`}
                          >
                            {timetable.status === "loading" ? (
                              <span className="lesson-skeleton" />
                            ) : (
                              <span>
                                {timetable.status === "ready"
                                  ? "수업 없음"
                                  : "—"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    const move = movementFor(
                      movements,
                      profile,
                      day,
                      period,
                      date,
                      subject,
                    );
                    const current =
                      isCurrentWeek &&
                      active?.day === day &&
                      active?.period === period;
                    const short = shortSettings[dateKey(date)];
                    const slot = short
                      ? createSchedule(short, timetable.maxPeriods).periods[
                          period
                        ]
                      : null;
                    return (
                      <div role="cell" key={day}>
                        <button
                          className={`lesson-card pastel-${subject.color} ${current ? "is-current" : ""}`}
                          onClick={() =>
                            onOpen("movement", { day, period, date, subject })
                          }
                          aria-label={`${WEEKDAYS[day]} ${period + 1}교시 ${subject.name}, ${subject.teacher ? subject.teacher + " 선생님" : "교사 정보 미제공"}${move.enabled ? `, ${move.room} 이동 수업` : ""}${current ? ", 현재 수업" : ""}, 이동 교실 설정`}
                        >
                          <div className="lesson-card-top">
                            <strong>{subject.name}</strong>
                            {move.enabled && (
                              <span className="move-badge">
                                <MapPin size={10} />
                                이동
                              </span>
                            )}
                          </div>
                          <div className="lesson-card-bottom">
                            <span>
                              {subject.teacher
                                ? `${subject.teacher} 선생님`
                                : "교사 정보 미제공"}
                            </span>
                            {current && (
                              <span className="in-progress">진행 중</span>
                            )}
                          </div>
                          {slot && (
                            <span className="short-card-time">
                              {timeLabel(slot.start)} – {timeLabel(slot.end)}
                            </span>
                          )}
                          <span className="lesson-edit-hint">
                            <GearSix size={14} />
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <footer className="timetable-footer">
          <p>
            <Info size={14} />
            과목은 나이스 공개 자료입니다. 교사명은 제공되지 않으며, 수업 시각은
            기본 설정입니다.
            {Object.keys(shortSettings).some((key) =>
              dates.some((date) => dateKey(date) === key),
            ) && " 단축 시간은 해당 날짜의 카드에 표시됩니다."}
          </p>
          <button
            className={`preview-time-button ${previewTime ? "active" : ""}`}
            onClick={onTogglePreview}
            disabled={timetable.status !== "ready" || !timetable.rowCount}
          >
            <Clock size={14} />
            {previewTime ? "현재 교시 미리보기 종료" : "현재 교시 미리보기"}
            <ArrowUpRight size={13} />
          </button>
        </footer>
      </main>
    </div>
  );
}
