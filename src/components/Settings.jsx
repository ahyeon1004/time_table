import { WidgetLink } from "./WidgetLink.jsx";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CaretDown,
  Check,
  MapPin,
  Play,
  SpeakerHigh,
  X,
} from "@phosphor-icons/react";
import { lessonFor } from "../lib/timetable.js";
import { Brand, Button, Field, Modal, Notice, Toggle } from "./ui.jsx";
import {
  addDays,
  createSchedule,
  dateKey,
  movementFor,
  parseDate,
  timeLabel,
  WEEKDAYS,
} from "../lib/schedule.js";

export function MovementDialog({
  selection,
  profile,
  movements,
  onClose,
  onSave,
}) {
  const subject = selection.subject;
  const initial = movementFor(
    movements,
    profile,
    selection.day,
    selection.period,
    selection.date,
    subject,
  );
  const [enabled, setEnabled] = useState(initial.enabled);
  const [room, setRoom] = useState(initial.room);
  const [scope, setScope] = useState(initial.scope ?? "weekly");
  const [error, setError] = useState("");
  function submit(event) {
    event.preventDefault();
    if (enabled && !room.trim()) {
      setError("이동할 교실을 입력해 주세요.");
      return;
    }
    onSave({ enabled, room: room.trim(), scope, subjectName: subject.name });
  }
  return (
    <Modal
      title="이동 수업 설정"
      subtitle={`${subject.name} · ${WEEKDAYS[selection.day]} ${selection.period + 1}교시`}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate>
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setError("");
            }}
          />
          <span>이동 수업으로 설정</span>
        </label>
        <Field label="이동할 교실" id="room" error={error}>
          <span className="input-with-icon">
            <MapPin size={18} />
            <input
              id="room"
              value={room}
              maxLength={40}
              disabled={!enabled}
              placeholder="예: 과학실, 컴퓨터실"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "room-error" : undefined}
              onChange={(e) => {
                setRoom(e.target.value);
                setError("");
              }}
            />
          </span>
        </Field>
        <fieldset className="scope-options">
          <legend>적용 범위</legend>
          <label>
            <input
              type="radio"
              name="movement-scope"
              checked={scope === "weekly"}
              onChange={() => setScope("weekly")}
            />
            <span>
              매주 반복
              <small>
                매주 {WEEKDAYS[selection.day]} {selection.period + 1}교시에 적용
              </small>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="movement-scope"
              checked={scope === "date"}
              onChange={() => setScope("date")}
            />
            <span>
              선택한 날짜에만 적용
              <small>
                {selection.date.getMonth() + 1}월 {selection.date.getDate()}
                일에만 적용
              </small>
            </span>
          </label>
        </fieldset>
        <p className="modal-help">
          <Bell size={15} />
          수업 전에 이동 교실을 알림으로 안내해 드려요.
        </p>
        <Button type="submit">
          저장
          <Check size={17} />
        </Button>
      </form>
    </Modal>
  );
}
function Segmented({ legend, name, choices, value, onChange }) {
  return (
    <fieldset className="segmented-field">
      <legend>{legend}</legend>
      <div className="segmented">
        {choices.map((choice) => (
          <label
            key={choice.value}
            className={String(value) === String(choice.value) ? "selected" : ""}
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={String(value) === String(choice.value)}
              onChange={() => onChange(choice.value)}
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function ShortDialog({
  initialDate,
  settings,
  onClose,
  onSave,
  onRemove,
}) {
  const defaults = { session: "all", reduction: 10, lunch: 45 };
  const [date, setDate] = useState(dateKey(initialDate));
  const [draft, setDraft] = useState(
    settings[dateKey(initialDate)] ?? defaults,
  );
  const [error, setError] = useState("");
  const schedule = createSchedule(draft);
  const update = (key, value) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  function changeDate(value) {
    setDate(value);
    setDraft(settings[value] ?? defaults);
    setError("");
  }
  return (
    <Modal
      title="단축수업 설정"
      subtitle="해당 날짜의 수업 시간을 한 번에 조정해요."
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const selectedDate = new FormData(event.currentTarget).get("date");
          if (!selectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
            setError("날짜를 선택해 주세요.");
            return;
          }
          onSave(String(selectedDate), draft);
        }}
        noValidate
      >
        <Field label="날짜" id="short-date" error={error}>
          <input
            id="short-date"
            name="date"
            type="date"
            value={date}
            required
            onInput={(event) => changeDate(event.currentTarget.value)}
            onChange={(event) => changeDate(event.target.value)}
          />
        </Field>
        <Segmented
          legend="적용 시간"
          name="session"
          choices={[
            { value: "morning", label: "오전" },
            { value: "afternoon", label: "오후" },
            { value: "all", label: "하루 종일" },
          ]}
          value={draft.session}
          onChange={(v) => update("session", v)}
        />
        <Segmented
          legend="단축 시간"
          name="reduction"
          choices={[
            { value: 5, label: "5분 단축" },
            { value: 10, label: "10분 단축" },
          ]}
          value={draft.reduction}
          onChange={(v) => update("reduction", v)}
        />
        <Segmented
          legend="점심시간"
          name="lunch"
          choices={[40, 45, 50].map((value) => ({
            value,
            label: `${value}분`,
          }))}
          value={draft.lunch}
          onChange={(v) => update("lunch", v)}
        />
        <section className="schedule-preview">
          <div className="preview-title">
            <h3>변경된 시간표 미리보기</h3>
            <span>
              점심 {timeLabel(schedule.lunch.start)}–
              {timeLabel(schedule.lunch.end)}
            </span>
          </div>
          <div className="preview-periods">
            {schedule.periods.map((period) => (
              <div key={period.period}>
                <span>{period.period}교시</span>
                <strong>
                  {timeLabel(period.start)}
                  <span>–</span>
                  {timeLabel(period.end)}
                </strong>
              </div>
            ))}
          </div>
        </section>
        <div className="modal-footer-actions">
          {settings[date] && (
            <button
              type="button"
              className="text-action reset-setting"
              onClick={() => onRemove(date)}
            >
              이 날짜 설정 해제
            </button>
          )}
          <Button type="submit">
            저장
            <Check size={17} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function LessonPicker({ week, timetable, onChoose, onClose }) {
  const [day, setDay] = useState(0);
  return (
    <Modal
      title="수업 및 이동 교실 설정"
      subtitle="교실을 설정할 수업을 선택해 주세요."
      onClose={onClose}
    >
      <Field id="picker-day" label="요일">
        <span className="select-wrap">
          <select
            id="picker-day"
            value={day}
            onChange={(event) => setDay(Number(event.target.value))}
          >
            {WEEKDAYS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
          <CaretDown size={15} />
        </span>
      </Field>
      <div className="lesson-picker">
        {Array.from({ length: timetable.maxPeriods }, (_, period) => {
          const date = addDays(week, day);
          const subject = lessonFor(timetable.byDate, date, period);
          if (!subject) return null;
          return (
            <button
              key={period}
              onClick={() => onChoose({ day, period, date, subject })}
            >
              <span className="picker-period">{period + 1}교시</span>
              <span>
                <strong>{subject.name}</strong>
                <small>
                  {subject.teacher
                    ? `${subject.teacher} 선생님${subject.teacherUnconfirmed ? " · 확인 필요" : ""}`
                    : "교사 정보 미제공"}
                </small>
              </span>
              <ArrowRight size={17} />
            </button>
          );
        })}
        {!timetable.byDate[dateKey(addDays(week, day))]?.some(Boolean) && (
          <p className="picker-empty">
            {timetable.status === "ready"
              ? "이 날에 등록된 수업이 없습니다."
              : "먼저 학교 시간표를 불러와 주세요."}
          </p>
        )}
      </div>
    </Modal>
  );
}
export function Notifications({
  push,
  navigate,
  preferences,
  onChange,
  onPreview,
  onPlay,
  playing,
}) {
  return (
    <main className="notifications-page">
      <header className="settings-topbar">
        <button onClick={() => navigate("/dashboard")} aria-label="시간표">
          <Brand compact />
        </button>
        <span>나의 학교생활, 조금 더 편하게.</span>
      </header>
      <section className="notification-settings">
        <button className="back-link" onClick={() => navigate("/dashboard")}>
          <ArrowLeft size={17} />
          시간표로 돌아가기
        </button>
        <header className="settings-heading">
          <span className="section-eyebrow">나의 알림</span>
          <h1>알림 설정</h1>
          <p>다음 수업과 이동 교실을 놓치지 않도록.</p>
        </header>
        <WidgetLink />
        <div className="notification-controls">
          <Toggle
            label="화면 알림"
            description="수업 시작 5분 전 화면 알림을 표시해요."
            checked={preferences.screen}
            onChange={(screen) => onChange({ ...preferences, screen })}
          />
          <Toggle
            label="알림음"
            description="화면 알림과 함께 알림음을 재생해요."
            checked={preferences.sound}
            onChange={(sound) => onChange({ ...preferences, sound })}
          />
          <Button
            variant="secondary"
            className="sound-preview"
            onClick={onPlay}
          >
            <Play size={17} weight={playing ? "fill" : "regular"} />
            {playing ? "알림음 재생 중" : "동글동글 뽁뽁 · 미리 듣기"}
            <span className={playing ? "sound-bars playing" : "sound-bars"}>
              <i />
              <i />
              <i />
              <i />
            </span>
          </Button>
          <p className="notification-permission-help">
            이 페이지가 열려 있는 동안 알림을 받을 수 있어요.
          </p>
        </div>
        <section
          className="notification-controls device-notification-controls"
          aria-labelledby="device-notification-title"
        >
          <h2 id="device-notification-title">이 기기 알림</h2>
          <p>{push.schedulingReady === false
            ? "자동 수업 알림을 준비 중입니다. 기기를 연결하면 테스트 알림을 받을 수 있어요."
            : "시간표 창을 닫아도 수업 시작 5분 전에 맥 알림으로 알려드려요."}</p>
          <p className="notification-permission-help">
            {!push.supported
              ? "이 브라우저에서는 지원되지 않습니다. HTTPS 환경의 최신 Safari 또는 Chrome을 사용해 주세요."
              : push.loading
                ? "연결 확인 중…"
                : !push.ready
                  ? "알림 서버 설정을 준비 중입니다."
                  : push.enabled
                    ? (push.schedulingReady === false ? "기기가 연결됐어요. 자동 수업 알림은 아직 준비 중입니다." : "이 기기의 수업 알림이 켜져 있어요.")
                    : push.permission === "denied"
                      ? "사이트 알림이 차단되어 있어요. 브라우저 설정에서 허용해 주세요."
                      : "알림을 허용하면 이 기기로 수업 안내를 받을 수 있어요."}
          </p>
          <div className="device-notification-actions">
            <Button
              disabled={
                !push.supported || !push.ready || push.loading || push.busy
              }
              onClick={() => {
                if (push.enabled) void push.disable().catch(() => {});
                else void push.enable();
              }}
            >
              {push.busy
                ? "처리 중…"
                : push.enabled
                  ? "이 기기 알림 끄기"
                  : "이 기기 알림 켜기"}
            </Button>
            <Button
              variant="secondary"
              disabled={!push.enabled || push.busy}
              onClick={push.test}
            >
              테스트 알림 보내기
            </Button>
          </div>
          {push.error && (
            <p role="alert" className="notification-permission-help">
              {push.error}
            </p>
          )}
          {push.message && (
            <p role="status" className="notification-permission-help">
              {push.message}
            </p>
          )}
          <p className="notification-permission-help">
            알림 소리와 배너 표시는 맥 시스템 설정을 따릅니다. 로그아웃하면 이
            기기의 알림이 중단되며, 로그인은 접속할 때마다 90일씩 자동 연장됩니다. 서버가 실행
            중이어야 알림이 발송됩니다.
          </p>
        </section>
        <section className="notification-examples">
          <div className="section-title">
            <h2>알림 예시 미리보기</h2>
            <span>이렇게 알려드려요</span>
          </div>
          <div className="notification-example">
            <Notice title="다음 수업은 수학입니다." time="지금" />
            <button
              className="preview-link"
              onClick={() => onPreview("다음 수업은 수학입니다.")}
            >
              알림 띄우기
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="notification-example">
            <Notice
              title="5분 뒤 과학 수업이 시작됩니다."
              body="과학실로 이동해주세요."
            />
            <button
              className="preview-link"
              onClick={() =>
                onPreview(
                  "5분 뒤 과학 수업이 시작됩니다.",
                  "과학실로 이동해주세요.",
                )
              }
            >
              알림 띄우기
              <ArrowRight size={14} />
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
