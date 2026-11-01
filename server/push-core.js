import { Buffer } from "node:buffer";
import { normalizeTimetable } from "../src/lib/timetable.js";
import {
  createSchedule,
  dateKey,
  mondayOf,
  movementFor,
} from "../src/lib/schedule.js";
export function validSubscription(value) {
  try {
    const url = new URL(value.endpoint);
    const host = url.hostname;
    const trusted =
      host === "fcm.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host === "web.push.apple.com" ||
      host.endsWith(".push.apple.com");
    return (
      trusted &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (!url.port || url.port === "443") &&
      value.endpoint.length < 4096 &&
      /^[A-Za-z0-9_-]+$/.test(value.keys?.p256dh ?? "") &&
      Buffer.from(value.keys.p256dh, "base64url").length === 65 &&
      /^[A-Za-z0-9_-]+$/.test(value.keys?.auth ?? "") &&
      Buffer.from(value.keys.auth, "base64url").length === 16
    );
  } catch {
    return false;
  }
}
export function validPushSettings(value) {
  if (
    !value ||
    typeof value.sound !== "boolean" ||
    !value.movements ||
    !value.shortSettings
  )
    return false;
  for (const bucket of ["recurring", "dates"]) {
    if (
      !value.movements[bucket] ||
      typeof value.movements[bucket] !== "object" ||
      Array.isArray(value.movements[bucket])
    )
      return false;
    if (Object.keys(value.movements[bucket]).length > 400) return false;
    for (const setting of Object.values(value.movements[bucket])) {
      if (
        !setting ||
        typeof setting.enabled !== "boolean" ||
        typeof setting.room !== "string" ||
        setting.room.length > 40 ||
        typeof setting.subjectName !== "string" ||
        setting.subjectName.length > 200 ||
        !["weekly", "date"].includes(setting.scope)
      )
        return false;
    }
  }
  if (
    typeof value.shortSettings !== "object" ||
    Array.isArray(value.shortSettings) ||
    Object.keys(value.shortSettings).length > 400
  )
    return false;
  return Object.entries(value.shortSettings).every(
    ([date, setting]) =>
      /^20\d{2}-\d{2}-\d{2}$/.test(date) &&
      setting &&
      ["all", "morning", "afternoon"].includes(setting.session) &&
      [5, 10].includes(setting.reduction) &&
      [40, 45, 50].includes(setting.lunch),
  );
}
export function seoulClock(now) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const date = new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
  );
  return {
    date,
    key: dateKey(date),
    day: (date.getDay() + 6) % 7,
    minute:
      Number(parts.hour) * 60 +
      Number(parts.minute) +
      Number(parts.second) / 60,
  };
}
export function duePush(device, timetable, now) {
  const clock = seoulClock(now);
  if (clock.day >= 5) return [];
  const lessons = timetable.byDate[clock.key] ?? [];
  const schedule = createSchedule(
    device.settings.shortSettings[clock.key],
    Math.max(7, lessons.length),
  );
  return lessons.flatMap((lesson, period) => {
    if (!lesson) return [];
    const difference = schedule.periods[period].start - clock.minute;
    if (difference <= 0 || difference > 5) return [];
    const move = movementFor(
      device.settings.movements,
      device.profile,
      clock.day,
      period,
      clock.date,
      lesson,
    );
    const body = [
      lesson.teacher ? `${lesson.teacher} 선생님` : "",
      `${period + 1}교시`,
      move.enabled ? `${move.room}로 이동해주세요.` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return [
      {
        key: `${device.profile.grade}-${device.profile.classroom}:${clock.key}:${period}`,
        payload: {
          title: `${Math.ceil(difference)}분 뒤 ${lesson.name} 수업이 시작됩니다.`,
          body,
          tag: `lesson-${clock.key}-${period}`,
          url: "/#/dashboard",
          silent: !device.settings.sound,
          expiresAt: now.getTime() + Math.ceil(difference * 60_000),
        },
      },
    ];
  });
}
export function createPushService({
  loadTimetable,
  getConfig,
  storeFactory,
  send,
}) {
  let database,
    running = false,
    timer;
  const store = () => (database ??= storeFactory());
  const lastTests = new Map();
  async function deliver(device, payload, config) {
    try {
      await send(device.subscription, payload, config);
      return true;
    } catch (error) {
      if ([404, 410].includes(error.statusCode))
        await store().removePush(device.user_id, device.endpoint);
      return false;
    }
  }
  async function tick(now = new Date()) {
    if (running) return;
    running = true;
    const startedAt = Date.now();
    try {
      const config = await getConfig();
      if (!config.ready) return;
      const clock = seoulClock(now);
      if (clock.day >= 5 || clock.minute < 7 * 60 || clock.minute > 20 * 60)
        return;
      const devices = await store().pushDevices();
      const classes = new Map();
      for (const device of devices) {
        try {
          const week = mondayOf(clock.date);
          const key = `${device.profile.grade}:${device.profile.classroom}`;
          if (!classes.has(key))
            classes.set(
              key,
              Promise.resolve(
                loadTimetable({
                  grade: device.profile.grade,
                  classroom: device.profile.classroom,
                  from: dateKey(week),
                  to: dateKey(
                    new Date(
                      week.getFullYear(),
                      week.getMonth(),
                      week.getDate() + 4,
                    ),
                  ),
                }),
              ).then((payload) =>
                normalizeTimetable(payload, { ...device.profile, week }),
              ),
            );
          const timetable = await classes.get(key);
          for (const item of duePush(
            device,
            timetable,
            new Date(now.getTime() + Date.now() - startedAt),
          )) {
            if (!(await store().pushDevice(device.user_id, device.endpoint)))
              continue;
            if (
              !(await store().claimPush(
                device.endpoint,
                item.key,
                now.getTime(),
              ))
            )
              continue;
            const success = await deliver(device, item.payload, config);
            await store().finishPush(
              device.endpoint,
              item.key,
              now.getTime(),
              success,
            );
          }
        } catch {
          /* 재시도 시 최신 시간표만 사용한다. 과목을 추측해 보내지 않는다. */
        }
      }
    } finally {
      running = false;
    }
  }
  const middleware = async (req, res, next) => {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/api/push/")) return next?.();
    const json = (status, body) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(body));
    };
    try {
      const config = await getConfig();
      if (url.pathname === "/api/push/config" && req.method === "GET")
        return json(200, {
          ready: config.ready,
          publicKey: config.ready ? config.publicKey : null,
        });
      if (!config.ready)
        return json(503, {
          error: { message: "기기 알림 서버 설정을 준비 중입니다." },
        });
      const token = (req.headers.cookie ?? "")
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("bssm_session="))
        ?.slice("bssm_session=".length);
      const user = await store().user(token);
      if (!user)
        return json(401, { error: { message: "다시 로그인해 주세요." } });
      if (req.method !== "POST")
        return json(405, { error: { message: "지원하지 않는 요청입니다." } });
      if (
        req.headers.origin !== config.origin ||
        !req.headers["content-type"]?.startsWith("application/json")
      )
        return json(403, {
          error: { message: "올바른 화면에서 다시 시도해 주세요." },
        });
      let text = "";
      for await (const chunk of req) {
        text += chunk;
        if (Buffer.byteLength(text) > 100_000)
          return json(413, { error: { message: "설정이 너무 큽니다." } });
      }
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return json(400, { error: { message: "알림 설정을 확인해 주세요." } });
      }
      if (url.pathname === "/api/push/subscribe") {
        if (
          !user.profile ||
          !validSubscription(body.subscription) ||
          !validPushSettings(body.settings)
        )
          return json(400, {
            error: { message: "학생 정보와 알림 설정을 확인해 주세요." },
          });
        const sub = {
          endpoint: body.subscription.endpoint,
          keys: {
            p256dh: body.subscription.keys.p256dh,
            auth: body.subscription.keys.auth,
          },
        };
        await store().savePush(user, token, sub, body.settings);
        return json(200, { enabled: true });
      }
      if (typeof body.endpoint !== "string")
        return json(400, { error: { message: "알림 기기를 확인해 주세요." } });
      const device = await store().pushDevice(user.id, body.endpoint);
      if (url.pathname === "/api/push/status")
        return json(200, { enabled: !!device });
      if (url.pathname === "/api/push/unsubscribe") {
        await store().removePush(user.id, body.endpoint);
        return json(200, { enabled: false });
      }
      if (!device)
        return json(404, {
          error: { message: "이 기기의 알림을 먼저 켜 주세요." },
        });
      if (url.pathname === "/api/push/settings") {
        if (!validPushSettings(body.settings))
          return json(400, {
            error: { message: "알림 설정을 확인해 주세요." },
          });
        await store().updatePush(user.id, body.endpoint, body.settings);
        return json(200, { ok: true });
      }
      if (url.pathname === "/api/push/test") {
        if (Date.now() - (lastTests.get(user.id) ?? 0) < 10_000)
          return json(429, {
            error: { message: "잠시 후 다시 시도해 주세요." },
          });
        if (lastTests.size > 1000) lastTests.clear();
        lastTests.set(user.id, Date.now());
        const success = await deliver(
          device,
          {
            title: "시간표 알림이 연결됐어요.",
            body: "수업 시작 5분 전에 이 기기로 알려드릴게요.",
            tag: "bssm-test",
            url: "/#/notifications",
            silent: !device.settings.sound,
            expiresAt: Date.now() + 300_000,
          },
          config,
        );
        return json(
          success ? 200 : 502,
          success
            ? { ok: true }
            : {
                error: {
                  message:
                    "테스트 알림을 보내지 못했습니다. 기기 알림을 다시 연결해 주세요.",
                },
              },
        );
      }
      return json(404, { error: { message: "페이지를 찾을 수 없습니다." } });
    } catch {
      return json(500, {
        error: {
          message: "기기 알림을 처리하지 못했습니다. 다시 시도해 주세요.",
        },
      });
    }
  };
  return {
    middleware,
    tick,
    start() {
      if (timer) return;
      timer = setInterval(() => void tick().catch(() => {}), 30_000);
      timer.unref();
      void tick().catch(() => {});
    },
    close() {
      clearInterval(timer);
      timer = null;
    },
  };
}
