import { useCallback, useEffect, useState } from "react";
import { dateKey } from "./schedule.js";
import { normalizeTimetable } from "./timetable.js";

const cache = new Map();
const EMPTY = { byDate: {}, maxPeriods: 7, rowCount: 0, fetchedAt: null };
export function useTimetable(profile, week, enabled) {
  const weekKey = dateKey(week);
  const grade = profile?.grade,
    classroom = profile?.classroom;
  const key = `${grade}:${classroom}:${weekKey}`;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: "", status: "idle", ...EMPTY });
  const refresh = useCallback(() => {
    cache.delete(key);
    setRevision((value) => value + 1);
  }, [key]);
  useEffect(() => {
    if (!enabled || !grade || !classroom) return;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.time < 300_000) {
      setState({ key, status: "ready", ...cached.data });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setState({ key, status: "loading", ...EMPTY });
    const params = new URLSearchParams({ grade, classroom, week: weekKey });
    if (revision) params.set("refresh", "1");
    fetch(`/api/timetable?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          const error = new Error(
            body.error?.message || "시간표를 불러오지 못했습니다.",
          );
          error.code = body.error?.code;
          throw error;
        }
        const data = normalizeTimetable(body, {
          grade,
          classroom,
          week: new Date(`${weekKey}T00:00:00`),
        });
        if (active) {
          if (cache.size >= 64) cache.delete(cache.keys().next().value);
          cache.set(key, { data, time: Date.now() });
          setState({ key, status: "ready", ...data });
        }
      })
      .catch((error) => {
        if (active && error.name !== "AbortError")
          setState({
            key,
            status: "error",
            ...EMPTY,
            error: {
              code: error.code || "NETWORK_ERROR",
              message: error.message,
            },
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled, key, grade, classroom, weekKey, revision]);
  return {
    ...(enabled && state.key === key
      ? state
      : { ...EMPTY, status: enabled ? "loading" : "idle" }),
    refresh,
  };
}
