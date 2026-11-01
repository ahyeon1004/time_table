import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
import { createAuthStore } from "./auth-store.js";
import {
  createPushService,
  duePush,
  seoulClock,
  validSubscription,
  validPushSettings,
} from "./push.js";

const endpoint = "https://fcm.googleapis.com/fcm/send/example";
const subscription = {
  endpoint,
  keys: {
    p256dh: Buffer.alloc(65, 1).toString("base64url"),
    auth: Buffer.alloc(16, 1).toString("base64url"),
  },
};
const settings = () => ({
  sound: true,
  movements: { recurring: {}, dates: {} },
  shortSettings: {},
});
const config = {
  ready: true,
  origin: "http://127.0.0.1:5173",
  publicKey: "public-key",
};
const rows = [{ date: "2026-11-02", period: 1, content: "공통수학2" }];
const payload = {
  source: "NEIS",
  grade: "1",
  classroom: "1",
  from: "2026-11-02",
  to: "2026-11-06",
  rows,
};
function setup() {
  const store = createAuthStore(":memory:");
  store.login(
    { sub: "user-1", email: "a@bssm.hs.kr", name: "학생" },
    "session",
    Date.now() + 86400_000,
  );
  store.profile("user-1", { grade: "1", classroom: "1", number: "4" });
  const user = store.user("session");
  store.savePush(user, "session", subscription, settings());
  return { store, user };
}
const device = () => ({
  profile: { grade: "1", classroom: "1" },
  settings: settings(),
});
test("서버 시간대와 무관하게 서울 시간·5분 전·주말·빈 시간표를 계산한다", () => {
  const now = new Date("2026-11-01T23:35:00Z");
  assert.equal(seoulClock(now).key, "2026-11-02");
  const timetable = {
    byDate: { "2026-11-02": [{ name: "공통수학", teacher: "김규봉" }] },
  };
  assert.equal(
    duePush(device(), timetable, new Date("2026-11-01T23:34:59Z")).length,
    0,
  );
  assert.equal(
    duePush(device(), timetable, now)[0].payload.title,
    "5분 뒤 공통수학 수업이 시작됩니다.",
  );
  assert.equal(
    duePush(device(), timetable, new Date("2026-11-01T23:40:00Z")).length,
    0,
  );
  assert.equal(duePush(device(), { byDate: {} }, now).length, 0);
  assert.equal(
    duePush(device(), timetable, new Date("2026-11-01T00:00:00Z")).length,
    0,
  );
});
test("단축수업·날짜별 이동 교실·알림음 설정을 닫힌 웹의 알림에도 반영한다", () => {
  const d = device();
  d.settings.sound = false;
  d.settings.shortSettings["2026-11-02"] = {
    session: "all",
    reduction: 10,
    lunch: 45,
  };
  d.settings.movements.recurring["1-1:0:1"] = {
    enabled: true,
    room: "실습실",
    scope: "weekly",
    subjectName: "운영체제",
  };
  d.settings.movements.dates["1-1:2026-11-02:1"] = {
    enabled: true,
    room: "과학실",
    scope: "date",
    subjectName: "운영체제",
  };
  const timetable = {
    byDate: { "2026-11-02": [null, { name: "운영체제", teacher: "김현지" }] },
  };
  const due = duePush(d, timetable, new Date("2026-11-02T00:25:00Z"));
  assert.equal(due.length, 1);
  assert.match(due[0].payload.body, /과학실/);
  assert.equal(due[0].payload.silent, true);
  timetable.byDate["2026-11-02"][1].name = "체육";
  assert.ok(
    !duePush(
      d,
      timetable,
      new Date("2026-11-02T00:25:00Z"),
    )[0].payload.body.includes("과학실"),
  );
});
test("푸시 주소는 신뢰하는 HTTPS 브라우저 서비스로만 제한하고 설정 형식을 검증한다", () => {
  assert.ok(validSubscription(subscription));
  assert.ok(validPushSettings(settings()));
  for (const url of [
    "http://127.0.0.1/admin",
    "https://fcm.googleapis.com.evil.test/push",
    "https://user:password@fcm.googleapis.com/a",
    "https://fcm.googleapis.com:444/a",
  ])
    assert.ok(!validSubscription({ ...subscription, endpoint: url }));
  assert.ok(
    !validSubscription({ ...subscription, keys: { p256dh: "x", auth: "y" } }),
  );
  assert.ok(
    !validPushSettings({
      ...settings(),
      shortSettings: {
        "2026-11-02": { session: "all", reduction: 999, lunch: 45 },
      },
    }),
  );
});
test("스케줄러는 사용자·수업·기기별로 한 번만 보내고 로그아웃 후 보내지 않는다", async (t) => {
  const f = setup();
  t.after(() => f.store.close());
  let sent = 0;
  const service = createPushService({
    storeFactory: () => f.store,
    getConfig: async () => config,
    loadTimetable: async () => payload,
    send: async () => {
      sent++;
    },
  });
  const now = new Date("2026-11-01T23:35:00Z");
  await service.tick(now);
  await service.tick(now);
  assert.equal(sent, 1);
  f.store.logout("session");
  assert.equal(f.store.pushDevices().length, 0);
  await service.tick(now);
  assert.equal(sent, 1);
});
test("전송 실패는 재시도하고 폐기된 410 구독은 제거하며 다른 사용자가 구독을 가로채지 못한다", async (t) => {
  const f = setup();
  t.after(() => f.store.close());
  let sent = 0;
  const service = createPushService({
    storeFactory: () => f.store,
    getConfig: async () => config,
    loadTimetable: async () => payload,
    send: async () => {
      sent++;
      if (sent === 1) throw new Error("network");
    },
  });
  const now = new Date("2026-11-01T23:35:00Z");
  await service.tick(now);
  await service.tick(now);
  assert.equal(sent, 2);
  f.store.login(
    { sub: "other", email: "b@bssm.hs.kr" },
    "other",
    Date.now() + 86400_000,
  );
  assert.throws(() =>
    f.store.savePush(f.store.user("other"), "other", subscription, settings()),
  );
  const gone = createPushService({
    storeFactory: () => f.store,
    getConfig: async () => config,
    loadTimetable: async () => ({
      ...payload,
      rows: [{ date: "2026-11-02", period: 2, content: "체육2" }],
    }),
    send: async () => {
      throw { statusCode: 410 };
    },
  });
  await gone.tick(new Date("2026-11-02T00:35:00Z"));
  assert.equal(f.store.pushDevice(f.user.id, endpoint), null);
});
test("로그아웃이 시간표 조회 중 발생해도 전송하지 않는다", async (t) => {
  const f = setup();
  t.after(() => f.store.close());
  let sent = 0;
  const service = createPushService({
    storeFactory: () => f.store,
    getConfig: async () => config,
    loadTimetable: async () => {
      f.store.logout("session");
      return payload;
    },
    send: async () => {
      sent++;
    },
  });
  await service.tick(new Date("2026-11-01T23:35:00Z"));
  assert.equal(sent, 0);
});
test("구독 API는 로그인·동일 출처를 확인하고 다른 계정의 기기를 수정하지 못한다", async (t) => {
  const f = setup();
  t.after(() => f.store.close());
  const service = createPushService({
    storeFactory: () => f.store,
    getConfig: async () => config,
    send: async () => {},
  });
  const request = async (
    action,
    { token = "session", origin = config.origin, body = { endpoint } } = {},
  ) => {
    const req = {
      url: "/api/push/" + action,
      method: "POST",
      headers: {
        cookie: `bssm_session=${token}`,
        origin,
        "content-type": "application/json",
      },
      async *[Symbol.asyncIterator]() {
        yield JSON.stringify(body);
      },
    };
    const res = {
      status: 200,
      setHeader() {},
      writeHead(s) {
        this.status = s;
      },
      end(b) {
        this.body = JSON.parse(b);
      },
    };
    await service.middleware(req, res);
    return res;
  };
  assert.equal((await request("status", { token: "forged" })).status, 401);
  assert.equal(
    (await request("unsubscribe", { origin: "https://evil.test" })).status,
    403,
  );
  assert.equal((await request("status")).body.enabled, true);
  assert.equal(
    (await request("settings", { body: { endpoint, settings: settings() } }))
      .status,
    200,
  );
  assert.equal((await request("test")).status, 200);
  assert.equal((await request("test")).status, 429);
  assert.equal((await request("unsubscribe")).status, 200);
  assert.equal((await request("status")).body.enabled, false);
});

test("서비스워커는 열린 웹 창 없이도 OS 알림을 만들고 지연 메시지를 구분한다", async () => {
  const source = await readFile(
    new URL("../public/sw.js", import.meta.url),
    "utf8",
  );
  const handlers = {},
    notices = [];
  const scope = {
    location: { origin: "https://timetable.example" },
    addEventListener(type, fn) {
      handlers[type] = fn;
    },
    registration: {
      async showNotification(title, options) {
        notices.push({ title, options });
      },
    },
  };
  vm.runInNewContext(source, { self: scope, URL, Date });
  let complete;
  handlers.push({
    data: {
      json: () => ({
        title: "5분 뒤 운영체제",
        body: "실습실로 이동해주세요.",
        url: "https://evil.example",
        expiresAt: Date.now() + 60_000,
      }),
    },
    waitUntil(promise) {
      complete = promise;
    },
  });
  await complete;
  assert.equal(notices[0].title, "5분 뒤 운영체제");
  assert.equal(notices[0].options.data.url, "/#/dashboard");
  handlers.push({
    data: { json: () => ({ title: "오래된 수업", expiresAt: 1 }) },
    waitUntil(promise) {
      complete = promise;
    },
  });
  await complete;
  assert.equal(notices[1].title, "시간표 알림");
  assert.match(notices[1].options.body, /늦게/);
});

test("알림 클릭은 허용된 앱 화면만 열고 외부 주소로 이동하지 않는다", async () => {
  const handlers = {};
  let opened;
  const self = {
    location: { origin: "https://timetable.example" },
    addEventListener(type, fn) {
      handlers[type] = fn;
    },
    clients: {
      async matchAll() {
        return [];
      },
      async openWindow(url) {
        opened = url;
      },
    },
  };
  vm.runInNewContext(
    await readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    { self, URL, Date },
  );
  let complete;
  handlers.notificationclick({
    notification: { data: { url: "https://evil.example" }, close() {} },
    waitUntil(promise) {
      complete = promise;
    },
  });
  await complete;
  assert.equal(opened, "https://timetable.example/#/dashboard");
});
