import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { edgeStore } from "../edge/store.js";
import { handleAuth, authConfig } from "../edge/auth.js";
import worker from "../edge/worker.js";

async function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    await readFile(
      new URL("../migrations/0001_auth.sql", import.meta.url),
      "utf8",
    ),
  );
  t.after(() => sqlite.close());
  const statement = (sql, args = []) => ({
    bind(...values) {
      return statement(sql, values);
    },
    async first() {
      return sqlite.prepare(sql).get(...args) ?? null;
    },
    async all() {
      return { results: sqlite.prepare(sql).all(...args) };
    },
    async run() {
      const result = sqlite.prepare(sql).run(...args);
      return { meta: { changes: result.changes } };
    },
  });
  const db = {
    prepare: (sql) => statement(sql),
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const item of statements) results.push(await item.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const env = {
    DB: db,
    APP_ORIGIN: "https://timetable.example",
    GOOGLE_ALLOWED_DOMAINS: "bssm.hs.kr",
    GOOGLE_CLIENT_ID: "client",
    GOOGLE_CLIENT_SECRET: "secret",
    ASSETS: { fetch: async () => new Response("asset") },
  };
  return { env, store: edgeStore(db) };
}
test("D1 계정·학생 프로필·세션·기기 소유권·중복 알림 기록을 비동기로 보존한다", async (t) => {
  const { store } = await fixture(t);
  const claims = { sub: "one", email: "one@bssm.hs.kr", name: "학생" };
  await store.login(claims, "session", Date.now() + 3600_000);
  await store.profile("one", { grade: "1", classroom: "2", number: "4" });
  const user = await store.user("session");
  assert.equal(user.profile.classroom, "2");
  const subscription = {
    endpoint: "https://fcm.googleapis.com/example",
    keys: { p256dh: "a", auth: "b" },
  };
  const settings = {
    sound: true,
    movements: { recurring: {}, dates: {} },
    shortSettings: {},
  };
  await store.savePush(user, "session", subscription, settings);
  assert.equal((await store.pushDevices()).length, 1);
  assert.equal(
    await store.claimPush(subscription.endpoint, "lesson", Date.now()),
    true,
  );
  assert.equal(
    await store.claimPush(subscription.endpoint, "lesson", Date.now()),
    false,
  );
  await store.finishPush(subscription.endpoint, "lesson", Date.now(), true);
  assert.equal(
    await store.claimPush(
      subscription.endpoint,
      "lesson",
      Date.now() + 180_000,
    ),
    false,
  );
  await store.login({ ...claims, sub: "two" }, "other", Date.now() + 3600_000);
  await assert.rejects(() =>
    store.savePush({ id: "two" }, "other", subscription, settings),
  );
  await store.logout("session");
  assert.equal(await store.user("session"), null);
  assert.equal(await store.pushDevice(user.id, subscription.endpoint), null);
});
test("서버리스 Google 인증도 브라우저 state·PKCE·학교 도메인·nonce를 검증한다", async (t) => {
  const { store, env } = await fixture(t);
  assert.equal(authConfig(env).ready, true);
  const start = await handleAuth(
    new Request(env.APP_ORIGIN + "/api/auth/google"),
    env,
    store,
  );
  const authorization = new URL(start.headers.get("location"));
  const cookie = start.headers.getSetCookie()[0].split(";")[0];
  assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
  const callback =
    env.APP_ORIGIN +
    "/api/auth/callback?code=one&state=" +
    authorization.searchParams.get("state");
  const hooks = {
    exchange: async (code, verifier) => {
      assert.equal(code, "one");
      assert.ok(verifier);
      return { id_token: "signed" };
    },
    verify: async () => ({
      sub: "student",
      email: "user@bssm.hs.kr",
      email_verified: true,
      hd: "bssm.hs.kr",
      nonce: authorization.searchParams.get("nonce"),
    }),
  };
  const response = await handleAuth(
    new Request(callback, { headers: { cookie } }),
    env,
    store,
    hooks,
  );
  assert.equal(response.headers.get("location"), "/#/profile");
  const session = response.headers
    .getSetCookie()
    .find((x) => x.startsWith("bssm_session="));
  assert.ok(session.includes("Secure"));
  assert.ok(session.includes("HttpOnly"));
  const replay = await handleAuth(
    new Request(callback, { headers: { cookie } }),
    env,
    store,
    hooks,
  );
  assert.equal(replay.headers.get("location"), "/#/auth?error=invalid");
  const save = await handleAuth(
    new Request(env.APP_ORIGIN + "/api/auth/profile", {
      method: "POST",
      headers: {
        cookie: session.split(";")[0],
        origin: "https://evil.example",
        "content-type": "application/json",
      },
      body: "{}",
    }),
    env,
    store,
  );
  assert.equal(save.status, 403);
});
test("Workers는 정적 화면·준비 상태·잘못된 API 요청을 구분하고 비밀값을 응답하지 않는다", async (t) => {
  const { env } = await fixture(t);
  assert.equal(
    await (await worker.fetch(new Request(env.APP_ORIGIN + "/"), env)).text(),
    "asset",
  );
  assert.equal(
    (await worker.fetch(new Request(env.APP_ORIGIN + "/api/health"), env))
      .status,
    200,
  );
  assert.equal(
    (
      await worker.fetch(
        new Request(env.APP_ORIGIN + "/api/timetable?grade=9"),
        env,
      )
    ).status,
    400,
  );
  const push = await worker.fetch(
    new Request(env.APP_ORIGIN + "/api/push/config"),
    env,
  );
  assert.deepEqual(await push.json(), { ready: false, publicKey: null });
  const response = await worker.fetch(
    new Request(env.APP_ORIGIN + "/api/auth/config"),
    env,
  );
  const body = await response.text();
  assert.ok(!body.includes(env.GOOGLE_CLIENT_SECRET));
});
