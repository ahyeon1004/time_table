import test from "node:test";
import assert from "node:assert/strict";
import api from "../api/index.js";

test("Vercel API는 설정 누락을 안내하고 비밀키 없는 예약 호출을 거부한다", async () => {
  const call = (path, options) => api.fetch(new Request("https://example.vercel.app" + path, options));
  const health = await call("/api/health");
  assert.deepEqual(await health.json(), { ok: true, runtime: "vercel" });
  const push = await call("/api/push/config");
  const config = await push.json();
  assert.equal(config.schedulingReady, false);
  assert.equal(config.ready, false);
  assert.equal((await call("/api/push/dispatch")).status, 401);
  assert.equal((await call("/api/push/dispatch", { headers: { Authorization: "Bearer incorrect" } })).status, 401);
  assert.equal((await call("/api/timetable?grade=9")).status, 400);
});
