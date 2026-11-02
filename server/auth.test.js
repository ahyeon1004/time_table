import test from "node:test";
import assert from "node:assert/strict";
import {
  createAuthMiddleware,
  validateSchoolClaims,
  validStudentProfile,
} from "./auth.js";
import { createAuthStore } from "./auth-store.js";

const config = {
  ready: true,
  origin: "http://127.0.0.1:5173",
  clientId: "test-client",
  clientSecret: "never-return-this",
  domains: ["bssm.hs.kr"],
};
const claims = {
  sub: "student-1",
  email: "student@bssm.hs.kr",
  hd: "bssm.hs.kr",
  email_verified: true,
  name: "학생",
};
function fixture() {
  const store = createAuthStore(":memory:");
  let authorization,
    override = {};
  const client = {
    async generateCodeVerifierAsync() {
      return { codeVerifier: "verifier", codeChallenge: "challenge" };
    },
    generateAuthUrl(params) {
      authorization = params;
      return (
        "https://accounts.google.com/o/oauth2/v2/auth?" +
        new URLSearchParams(params)
      );
    },
    async getToken(params) {
      assert.equal(params.codeVerifier, "verifier");
      return { tokens: { id_token: "signed-token" } };
    },
    async verifyIdToken(params) {
      assert.equal(params.audience, config.clientId);
      return {
        getPayload: () => ({
          ...claims,
          nonce: authorization.nonce,
          ...override,
        }),
      };
    },
  };
  const middleware = createAuthMiddleware({
    getConfig: async () => config,
    storeFactory: () => store,
    clientFactory: () => client,
  });
  async function request(
    url,
    { method = "GET", cookie = "", body, origin = config.origin } = {},
  ) {
    const req = {
      url,
      method,
      headers: {
        cookie,
        ...(method === "POST"
          ? { origin, "content-type": "application/json" }
          : {}),
      },
      async *[Symbol.asyncIterator]() {
        if (body) yield JSON.stringify(body);
      },
    };
    const res = {
      headers: {},
      status: 200,
      setHeader(key, value) {
        this.headers[key.toLowerCase()] = value;
      },
      writeHead(status, headers = {}) {
        this.status = status;
        for (const [k, v] of Object.entries(headers)) this.setHeader(k, v);
      },
      end(value = "") {
        this.body = value;
      },
    };
    await middleware(req, res);
    return res;
  }
  async function start() {
    const res = await request("/api/auth/google");
    assert.equal(res.status, 302);
    const cookie = res.headers["set-cookie"].split(";")[0];
    return {
      cookie,
      url: "/api/auth/callback?code=one-time&state=" + authorization.state,
    };
  }
  return {
    request,
    start,
    store,
    setClaims(value) {
      override = value;
    },
  };
}
test("학교 도메인·Workspace hd·검증 이메일·nonce 모두 일치해야 가입할 수 있다", () => {
  assert.equal(
    validateSchoolClaims({ ...claims, nonce: "n" }, "n", config.domains),
    true,
  );
  for (const patch of [
    { hd: "gmail.com" },
    { hd: undefined },
    { email: "student@bssm.hs.kr.evil.test" },
    { email_verified: false },
    { nonce: "wrong" },
    { sub: "" },
  ])
    assert.equal(
      validateSchoolClaims(
        { ...claims, nonce: "n", ...patch },
        "n",
        config.domains,
      ),
      false,
    );
  assert.equal(
    validStudentProfile({ grade: "1", classroom: "4", number: "12" }),
    true,
  );
  for (const patch of [
    { grade: "4" },
    { classroom: "5" },
    { number: "0" },
    { number: "1.5" },
    { number: "1234" },
  ])
    assert.ok(
      !validStudentProfile({
        grade: "1",
        classroom: "1",
        number: "12",
        ...patch,
      }),
    );
});
test("설정 누락 시 실제 인증을 가장하지 않고 설정 필요 상태를 반환한다", async () => {
  const middleware = createAuthMiddleware({
    getConfig: async () => ({ ...config, ready: false }),
    storeFactory: () => {
      throw new Error("must not open");
    },
  });
  let status, body;
  await middleware(
    { url: "/api/auth/google", method: "GET", headers: {} },
    {
      setHeader() {},
      writeHead(s) {
        status = s;
      },
      end(b) {
        body = b;
      },
    },
  );
  assert.equal(status, 503);
  assert.ok(!body.includes(config.clientSecret));
});
test("인증 콜백은 브라우저 쿠키·state를 확인하고 한 번만 사용한다", async (t) => {
  const f = fixture();
  t.after(() => f.store.close());
  const flow = await f.start();
  const missing = await f.request(flow.url);
  assert.equal(missing.headers.location, "/#/auth?error=invalid");
  const success = await f.request(flow.url, { cookie: flow.cookie });
  assert.equal(success.headers.location, "/#/profile");
  assert.ok(
    success.headers["set-cookie"][1].includes("HttpOnly; SameSite=Lax"),
  );
  const replay = await f.request(flow.url, { cookie: flow.cookie });
  assert.equal(replay.headers.location, "/#/auth?error=invalid");
  const wrong = await f.start();
  assert.equal(
    (
      await f.request(wrong.url.replace(/state=.*/, "state=wrong"), {
        cookie: wrong.cookie,
      })
    ).headers.location,
    "/#/auth?error=invalid",
  );
});
test("다른 학교·변조된 nonce는 세션을 발급하지 않는다", async (t) => {
  const f = fixture();
  t.after(() => f.store.close());
  for (const patch of [
    { hd: "other.school", email: "user@other.school" },
    { nonce: "wrong" },
  ]) {
    f.setClaims(patch);
    const flow = await f.start();
    const res = await f.request(flow.url, { cookie: flow.cookie });
    assert.equal(res.headers.location, "/#/account-error");
    assert.ok(!String(res.headers["set-cookie"]).includes("bssm_session="));
  }
});
test("학생 정보를 계정에 저장하고 재로그인 시 복원하며 로그아웃은 세션을 폐기한다", async (t) => {
  const f = fixture();
  t.after(() => f.store.close());
  const flow = await f.start();
  const res = await f.request(flow.url, { cookie: flow.cookie });
  const session = res.headers["set-cookie"][1].split(";")[0];
  const profile = { grade: "2", classroom: "3", number: "04" };
  assert.equal(
    (
      await f.request("/api/auth/profile", {
        method: "POST",
        cookie: session,
        body: profile,
        origin: "https://evil.test",
      })
    ).status,
    403,
  );
  assert.equal(
    (await f.request("/api/auth/profile", { method: "POST", body: profile }))
      .status,
    401,
  );
  const saved = await f.request("/api/auth/profile", {
    method: "POST",
    cookie: session,
    body: profile,
  });
  assert.deepEqual(JSON.parse(saved.body).user.profile, {
    ...profile,
    number: "4",
  });
  const again = await f.start();
  assert.equal(
    (await f.request(again.url, { cookie: again.cookie })).headers.location,
    "/#/dashboard",
  );
  f.setClaims({ sub: "student-2", email: "another@bssm.hs.kr" });
  const other = await f.start();
  const otherResult = await f.request(other.url, { cookie: other.cookie });
  assert.equal(otherResult.headers.location, "/#/profile");
  await f.request("/api/auth/logout", { method: "POST", cookie: session });
  assert.equal(
    JSON.parse((await f.request("/api/auth/session", { cookie: session })).body)
      .user,
    null,
  );
  assert.equal(
    JSON.parse(
      (await f.request("/api/auth/session", { cookie: "bssm_session=forged" }))
        .body,
    ).user,
    null,
  );
});

test("접속 시 90일 연장하며 기존 7일 로그인도 유지하고 만료·로그아웃 세션은 되살리지 않는다", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-02T00:00:00Z") });
  const f = fixture();
  t.after(() => f.store.close());
  f.store.login(claims, "existing", Date.now() + 7 * 86400_000);
  const visit = () => f.request("/api/auth/session", { cookie: "bssm_session=existing" });
  let response = await visit();
  assert.equal(JSON.parse(response.body).user.id, claims.sub);
  assert.match(response.headers["set-cookie"], /Max-Age=7776000/);
  assert.match(response.headers["set-cookie"], /HttpOnly/);
  t.mock.timers.tick(8 * 86400_000);
  response = await visit();
  assert.equal(JSON.parse(response.body).user.id, claims.sub);
  t.mock.timers.tick(89 * 86400_000);
  assert.equal(JSON.parse((await visit()).body).user.id, claims.sub);
  t.mock.timers.tick(91 * 86400_000);
  response = await visit();
  assert.equal(JSON.parse(response.body).user, null);
  assert.equal(response.headers["set-cookie"], undefined);
  f.store.login(claims, "new", Date.now() + 86400_000);
  await f.request("/api/auth/logout", { method: "POST", cookie: "bssm_session=new" });
  response = await f.request("/api/auth/session", { cookie: "bssm_session=new" });
  assert.equal(JSON.parse(response.body).user, null);
  assert.equal(response.headers["set-cookie"], undefined);
});
