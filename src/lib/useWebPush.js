import { useCallback, useEffect, useRef, useState } from "react";

function withTimeout(promise, message, duration = 20_000) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), duration);
    }),
  ]).finally(() => clearTimeout(timer));
}
async function api(action, body) {
  const response = await fetch(`/api/push/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message || "기기 알림 연결에 실패했습니다.");
  return data;
}
function applicationKey(value) {
  const raw = atob(
    value.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (value.length % 4)) % 4),
  );
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
export function useWebPush({ user, profile, movements, shortSettings, sound }) {
  const supported =
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
  const [state, setState] = useState({
    loading: true,
    busy: false,
    enabled: false,
    ready: false,
    schedulingReady: true,
    permission: supported ? Notification.permission : "unsupported",
    error: "",
    message: "",
  });
  const subscription = useRef(null);
  const latest = useRef();
  const serialized = JSON.stringify({ sound, movements, shortSettings });
  latest.current = JSON.parse(serialized);
  const check = useCallback(async () => {
    if (!user || !supported) {
      setState((s) => ({ ...s, loading: false, enabled: false }));
      return;
    }
    try {
      const response = await fetch("/api/push/config", { cache: "no-store" });
      if (!response.ok) throw new Error("알림 서버에 연결하지 못했습니다.");
      const config = await response.json();
      const registration = await navigator.serviceWorker.getRegistration("/");
      const sub = await registration?.pushManager.getSubscription();
      subscription.current = sub ?? null;
      const status =
        sub && config.ready
          ? await api("status", { endpoint: sub.endpoint })
          : { enabled: false };
      setState((s) => ({
        ...s,
        loading: false,
        ready: config.ready,
        schedulingReady: config.schedulingReady !== false,
        enabled: status.enabled && Notification.permission === "granted",
        permission: Notification.permission,
        error: "",
      }));
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: error.message }));
    }
  }, [user?.id, supported]);
  useEffect(() => {
    void check();
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [check]);
  useEffect(() => {
    if (!state.enabled || !subscription.current) return;
    let active = true;
    const timer = setTimeout(() => {
      api("subscribe", {
        subscription: subscription.current.toJSON(),
        settings: latest.current,
      })
        .then(() => {
          if (active) setState((s) => ({ ...s, error: "" }));
        })
        .catch((error) => {
          if (active)
            setState((s) => ({
              ...s,
              error: "알림 설정을 서버에 저장하지 못했습니다. " + error.message,
            }));
        });
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [state.enabled, serialized, profile?.grade, profile?.classroom]);
  async function enable() {
    if (!supported || !profile) return;
    setState((s) => ({ ...s, busy: true, error: "", message: "" }));
    let sub;
    try {
      // Safari 등에서 사용자 클릭 동작 안에서 권한을 요청한다.
      const permission = await withTimeout(
        Notification.requestPermission(),
        "알림 허용 요청이 대기 중입니다. 브라우저의 사이트 알림을 허용한 뒤 다시 눌러 주세요.",
      );
      if (permission !== "granted")
        throw new Error(
          permission === "denied"
            ? "브라우저 또는 맥 알림 설정에서 이 사이트의 알림을 허용해 주세요."
            : "알림 허용을 완료하지 않았습니다.",
        );
      const response = await fetch("/api/push/config", { cache: "no-store" });
      const config = await response.json();
      if (!response.ok || !config.ready)
        throw new Error("알림 서버 설정이 아직 완료되지 않았습니다.");
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      await withTimeout(
        navigator.serviceWorker.ready,
        "알림 연결을 준비하지 못했습니다. 새로고침한 뒤 다시 시도해 주세요.",
      );
      sub = await registration.pushManager.getSubscription();
      if (
        sub &&
        JSON.stringify(
          Array.from(new Uint8Array(sub.options.applicationServerKey)),
        ) !== JSON.stringify(Array.from(applicationKey(config.publicKey)))
      ) {
        await sub.unsubscribe();
        sub = null;
      }
      sub ??= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationKey(config.publicKey),
      });
      await api("subscribe", {
        subscription: sub.toJSON(),
        settings: latest.current,
      });
      subscription.current = sub;
      setState((s) => ({
        ...s,
        busy: false,
        enabled: true,
        permission: "granted",
        error: "",
        message: "이 기기의 수업 알림을 켰어요.",
      }));
    } catch (error) {
      setState((s) => ({
        ...s,
        busy: false,
        permission: Notification.permission,
        error: error.message,
      }));
    }
  }
  async function disable() {
    setState((s) => ({ ...s, busy: true, error: "", message: "" }));
    try {
      const registration = supported
        ? await navigator.serviceWorker.getRegistration("/")
        : null;
      const sub =
        subscription.current ??
        (await registration?.pushManager.getSubscription());
      if (sub) {
        await api("unsubscribe", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      subscription.current = null;
      setState((s) => ({
        ...s,
        busy: false,
        enabled: false,
        message: "이 기기의 수업 알림을 껐어요.",
      }));
    } catch (error) {
      setState((s) => ({ ...s, busy: false, error: error.message }));
      throw error;
    }
  }
  async function test() {
    if (!subscription.current) return;
    setState((s) => ({ ...s, busy: true, error: "", message: "" }));
    try {
      await api("test", { endpoint: subscription.current.endpoint });
      setState((s) => ({
        ...s,
        busy: false,
        message: "테스트 알림을 보냈어요. 맥 알림 센터를 확인해 주세요.",
      }));
    } catch (error) {
      setState((s) => ({ ...s, busy: false, error: error.message }));
    }
  }
  return { ...state, supported, enable, disable, test, retry: check };
}
