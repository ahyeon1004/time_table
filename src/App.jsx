import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconContext } from "@phosphor-icons/react";
import {
  AccountError,
  GoogleAuth,
  Landing,
  Login,
  Profile,
} from "./components/Auth.jsx";
import Dashboard from "./components/Dashboard.jsx";
import {
  LessonPicker,
  MovementDialog,
  Notifications,
  ShortDialog,
} from "./components/Settings.jsx";
import { Toast } from "./components/ui.jsx";
import {
  createSchedule,
  addDays,
  dateKey,
  mondayOf,
  movementFor,
  nextLesson,
  parseDate,
} from "./lib/schedule.js";

import { useTimetable } from "./lib/useTimetable.js";

const validProfile = (value) =>
  value &&
  ["1", "2", "3"].includes(value.grade) &&
  ["1", "2", "3", "4"].includes(value.classroom) &&
  /^\d+$/.test(value.number) &&
  Number(value.number) > 0 &&
  Number.isSafeInteger(Number(value.number));
const validPreferences = (value) =>
  value &&
  typeof value.screen === "boolean" &&
  typeof value.sound === "boolean";
const validMovement = (value) =>
  value &&
  typeof value.enabled === "boolean" &&
  typeof value.subjectName === "string" &&
  typeof value.room === "string" &&
  value.room.length <= 40 &&
  ["weekly", "date"].includes(value.scope);
const validMovements = (value) =>
  value &&
  ["recurring", "dates"].every(
    (key) =>
      value[key] &&
      typeof value[key] === "object" &&
      !Array.isArray(value[key]) &&
      Object.values(value[key]).every(validMovement),
  );
const validShortSettings = (value) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.entries(value).every(
    ([key, setting]) =>
      /^\d{4}-\d{2}-\d{2}$/.test(key) &&
      setting &&
      ["morning", "afternoon", "all"].includes(setting.session) &&
      [5, 10].includes(setting.reduction) &&
      [40, 45, 50].includes(setting.lunch),
  );

function usePersistent(key, initial, validate) {
  const [state, setState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      return validate(saved) ? saved : initial;
    } catch {
      return initial;
    }
  });
  const [error, setError] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
      setError(false);
    } catch {
      setError(true);
    }
  }, [key, state]);
  return [state, setState, error];
}
function readRoute() {
  return (window.location.hash.slice(1) || "/").split("?")[0];
}
export default function App() {
  const [route, setRoute] = useState(readRoute);
  const [profile, setProfile, profileError] = usePersistent(
    "bssm.profile.v1",
    null,
    validProfile,
  );
  const [movements, setMovements, movementError] = usePersistent(
    "bssm.movements.neis.v1",
    { recurring: {}, dates: {} },
    validMovements,
  );
  const [shortSettings, setShortSettings, shortError] = usePersistent(
    "bssm.short.neis.v1",
    {},
    validShortSettings,
  );
  const [preferences, setPreferences, prefError] = usePersistent(
    "bssm.notifications.v1",
    { screen: true, sound: true },
    validPreferences,
  );
  const [week, setWeek] = useState(() => mondayOf(new Date(), true));
  const [clock, setClock] = useState(() => new Date());
  const [previewTime, setPreviewTime] = useState(false);
  const [previewDate, setPreviewDate] = useState(null);
  const previousWeek = useRef(null);
  const now = previewTime && previewDate ? previewDate : clock;
  const dataEnabled =
    Boolean(profile) && ["/dashboard", "/notifications"].includes(route);
  const operationalWeek = mondayOf(now, true);
  const live = useTimetable(profile, operationalWeek, dataEnabled);
  const sameWeek = dateKey(week) === dateKey(operationalWeek);
  const selected = useTimetable(profile, week, dataEnabled && !sameWeek);
  const timetable = sameWeek ? live : selected;
  const needsNextWeek =
    live.status === "ready" && !nextLesson(now, shortSettings, live.byDate);
  const lookahead = useTimetable(
    profile,
    addDays(operationalWeek, 7),
    dataEnabled && needsNextWeek,
  );
  const currentLessons = useMemo(
    () => ({ ...live.byDate, ...lookahead.byDate }),
    [live.byDate, lookahead.byDate],
  );
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [playing, setPlaying] = useState(false);
  const soundTimer = useRef(null);
  const audioRef = useRef(null);
  const notified = useRef(new Set());
  const navigate = useCallback((path) => {
    window.location.hash = path;
  }, []);
  useEffect(() => {
    const changed = () => {
      setRoute(readRoute());
      setModal(null);
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    const labels = {
      "/login": "로그인",
      "/signup": "회원가입",
      "/auth": "Google 인증 안내",
      "/profile": "학생 정보 등록",
      "/account-error": "학교 계정 안내",
      "/dashboard": "주간 시간표",
      "/notifications": "알림 설정",
    };
    document.title = `${labels[route] ?? "시간표"} · BSSM`;
    window.scrollTo({ top: 0, behavior: "instant" });
    const heading = document.querySelector("main h1");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }, [route]);
  const showToast = useCallback((title, body, notification = false) => {
    window.clearTimeout(toastTimer.current);
    setToast({ title, body, notification });
    toastTimer.current = window.setTimeout(
      () => setToast(null),
      notification ? 7500 : 3500,
    );
  }, []);
  const playSound = useCallback(
    async (manual = false) => {
      try {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioClass) throw new Error("Audio is not supported");
        if (!audioRef.current || audioRef.current.state === "closed")
          audioRef.current = new AudioClass();
        const context = audioRef.current;
        if (context.state === "suspended") {
          if (!manual) return;
          await context.resume();
        }
        [659.25, 880].forEach((frequency, index) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const start = context.currentTime + index * 0.19;
          oscillator.type = "sine";
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.07, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(start);
          oscillator.stop(start + 0.28);
          oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
          };
        });
        if (manual) {
          clearTimeout(soundTimer.current);
          setPlaying(true);
          soundTimer.current = window.setTimeout(() => setPlaying(false), 700);
        }
      } catch {
        if (manual) showToast("이 브라우저에서는 알림음을 재생할 수 없어요.");
      }
    },
    [showToast],
  );
  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      clearTimeout(soundTimer.current);
      if (audioRef.current && audioRef.current.state !== "closed")
        audioRef.current.close().catch(() => {});
    },
    [],
  );
  useEffect(() => {
    if (
      !profile ||
      live.status !== "ready" ||
      previewTime ||
      !preferences.screen ||
      !["/dashboard", "/notifications"].includes(route)
    )
      return;
    const next = nextLesson(now, shortSettings, currentLessons);
    if (!next) return;
    const difference = next.start.getTime() - now.getTime();
    const key = `${profile.grade}-${profile.classroom}:${dateKey(next.date)}:${next.period}`;
    if (difference > 300_000 || difference <= 0 || notified.current.has(key))
      return;
    notified.current.add(key);
    const move = movementFor(
      movements,
      profile,
      next.day,
      next.period,
      next.date,
      next.subject,
    );
    showToast(
      `${Math.ceil(difference / 60_000)}분 뒤 ${next.subject.name} 수업이 시작됩니다.`,
      move.enabled ? `${move.room}로 이동해주세요.` : undefined,
      true,
    );
    if (preferences.sound) void playSound();
  }, [
    now,
    profile,
    live.status,
    currentLessons,
    route,
    shortSettings,
    movements,
    preferences,
    previewTime,
    showToast,
    playSound,
  ]);
  function saveMovement(value) {
    const selection = modal.selection;
    const classKey = `${profile.grade}-${profile.classroom}`;
    const key =
      value.scope === "weekly"
        ? `${classKey}:${selection.day}:${selection.period}`
        : `${classKey}:${dateKey(selection.date)}:${selection.period}`;
    const bucket = value.scope === "weekly" ? "recurring" : "dates";
    setMovements((previous) => {
      const next = {
        ...previous,
        [bucket]: { ...previous[bucket], [key]: value },
      };
      if (value.scope === "weekly") {
        next.dates = { ...previous.dates };
        delete next.dates[
          `${classKey}:${dateKey(selection.date)}:${selection.period}`
        ];
      }
      return next;
    });
    setModal(null);
    showToast("이동 수업 설정을 저장했어요.");
  }
  function togglePreview() {
    if (previewTime) {
      setWeek(previousWeek.current ?? mondayOf(new Date(), true));
      setPreviewTime(false);
    } else {
      const entry = Object.entries(timetable.byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .find(([, lessons]) => lessons.some(Boolean));
      if (!entry) {
        showToast("먼저 등록된 학교 시간표를 불러와 주세요.");
        return;
      }
      const [date, lessons] = entry;
      const period = lessons[2] ? 2 : lessons.findIndex(Boolean);
      const slot = createSchedule(
        shortSettings[date],
        Math.max(7, lessons.length),
      ).periods[period];
      const target = parseDate(date);
      target.setHours(Math.floor(slot.start / 60), (slot.start % 60) + 1, 0, 0);
      previousWeek.current = week;
      setPreviewDate(target);
      setPreviewTime(true);
      showToast(
        `${target.getMonth() + 1}월 ${target.getDate()}일 ${target.getHours()}:${String(target.getMinutes()).padStart(2, "0")} 기준으로 미리 봅니다.`,
      );
    }
  }
  let page;
  if (route === "/login" || route === "/signup")
    page = <Login navigate={navigate} signup={route === "/signup"} />;
  else if (route === "/auth")
    page = <GoogleAuth navigate={navigate} profile={profile} />;
  else if (route === "/account-error")
    page = <AccountError navigate={navigate} />;
  else if (route === "/profile" || (route === "/dashboard" && !profile))
    page = (
      <Profile
        profile={profile}
        navigate={navigate}
        onComplete={(value) => {
          setProfile(value);
          setPreviewTime(false);
          navigate("/dashboard");
          showToast("나의 시간표가 준비됐어요.");
        }}
      />
    );
  else if (route === "/dashboard")
    page = (
      <Dashboard
        profile={profile}
        timetable={timetable}
        currentLessons={currentLessons}
        liveStatus={live.status}
        now={now}
        week={week}
        setWeek={setWeek}
        shortSettings={shortSettings}
        movements={movements}
        navigate={navigate}
        onOpen={(type, selection) => setModal({ type, selection })}
        onSignOut={() => {
          navigate("/");
          setPreviewTime(false);
          showToast("로그아웃했어요.");
        }}
        previewTime={previewTime}
        onTogglePreview={togglePreview}
      />
    );
  else if (route === "/notifications")
    page = (
      <Notifications
        navigate={navigate}
        preferences={preferences}
        onChange={(value) => {
          setPreferences(value);
          showToast("알림 설정을 저장했어요.");
        }}
        playing={playing}
        onPlay={() => void playSound(true)}
        onPreview={(title, body) => {
          showToast(title, body, true);
          if (preferences.sound) void playSound(true);
        }}
      />
    );
  else page = <Landing navigate={navigate} />;
  return (
    <IconContext.Provider value={{ size: 20, weight: "regular" }}>
      {page}
      {(profileError || movementError || shortError || prefError) && (
        <div className="storage-warning" role="alert">
          브라우저 저장소를 사용할 수 없어 변경 사항이 새로고침 후 유지되지 않을
          수 있어요.
        </div>
      )}
      {modal?.type === "movement" && profile && (
        <MovementDialog
          selection={modal.selection}
          profile={profile}
          movements={movements}
          onClose={() => setModal(null)}
          onSave={saveMovement}
        />
      )}
      {modal?.type === "picker" && (
        <LessonPicker
          week={week}
          timetable={timetable}
          onClose={() => setModal(null)}
          onChoose={(selection) => setModal({ type: "movement", selection })}
        />
      )}
      {modal?.type === "short" && (
        <ShortDialog
          initialDate={
            dateKey(mondayOf(now)) === dateKey(week) &&
            now.getDay() > 0 &&
            now.getDay() < 6
              ? now
              : week
          }
          settings={shortSettings}
          onClose={() => setModal(null)}
          onSave={(date, setting) => {
            setShortSettings((previous) => ({ ...previous, [date]: setting }));
            setWeek(mondayOf(parseDate(date)));
            setModal(null);
            showToast("단축수업 설정을 저장했어요.");
          }}
          onRemove={(date) => {
            setShortSettings((previous) => {
              const next = { ...previous };
              delete next[date];
              return next;
            });
            setModal(null);
            showToast("기본 수업 시간으로 되돌렸어요.");
          }}
        />
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </IconContext.Provider>
  );
}
