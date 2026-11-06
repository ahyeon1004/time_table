import { createWidgetMiddleware } from "../server/widget.js";
import webpush from "web-push";
import { edgeStore } from "./store.js";
import { authConfig, handleAuth, json } from "./auth.js";
import { createPushService } from "../server/push-core.js";
import { SCHOOL, parseNeisResponse, queryRange } from "../server/neis.js";

const runtime = new WeakMap();
const cache = new Map();
export function environment(env) {
  let services = runtime.get(env);
  if (services) return services;
  const store = edgeStore(env.DB);
  async function load(range) {
    if (!env.NEIS_API_KEY) throw new Error("NEIS not configured");
    const key = JSON.stringify(range);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.time < 300_000) return cached.data;
    const params = new URLSearchParams({
      KEY: env.NEIS_API_KEY,
      Type: "json",
      pIndex: "1",
      pSize: "1000",
      ATPT_OFCDC_SC_CODE: SCHOOL.office,
      SD_SCHUL_CODE: SCHOOL.code,
      GRADE: range.grade,
      CLASS_NM: range.classroom,
      TI_FROM_YMD: range.from.replaceAll("-", ""),
      TI_TO_YMD: range.to.replaceAll("-", ""),
    });
    const response = await fetch(
      "https://open.neis.go.kr/hub/hisTimetable?" + params,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!response.ok) throw new Error("NEIS unavailable");
    const rows = parseNeisResponse(await response.json(), range);
    const data = {
      source: "NEIS",
      school: SCHOOL.name,
      ...range,
      rows,
      fetchedAt: new Date().toISOString(),
      teacherAvailable: false,
    };
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(key, { time: Date.now(), data });
    return data;
  }
  const push = createPushService({
    loadTimetable: load,
    storeFactory: () => store,
    getConfig: async () => {
      const auth = authConfig(env);
      return {
        ...auth,
        ready: !!(
          auth.ready &&
          env.WEB_PUSH_PUBLIC_KEY &&
          env.WEB_PUSH_PRIVATE_KEY &&
          env.WEB_PUSH_SUBJECT
        ),
        schedulingReady: env.PUSH_SCHEDULER_ENABLED !== "false",
        publicKey: env.WEB_PUSH_PUBLIC_KEY,
        privateKey: env.WEB_PUSH_PRIVATE_KEY,
        subject: env.WEB_PUSH_SUBJECT,
      };
    },
    send: async (subscription, payload, config) => {
      const details = webpush.generateRequestDetails(
        subscription,
        JSON.stringify(payload),
        {
          TTL: 300,
          urgency: "high",
          vapidDetails: {
            subject: config.subject,
            publicKey: config.publicKey,
            privateKey: config.privateKey,
          },
        },
      );
      const response = await fetch(details.endpoint, {
        method: details.method,
        headers: details.headers,
        body: details.body,
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        const error = new Error("Push rejected");
        error.statusCode = response.status;
        throw error;
      }
    },
  });
  services = { store, load, push };
  runtime.set(env, services);
  return services;
}
async function bridge(request, middleware) {
  const url = new URL(request.url);
  const headers = Object.fromEntries(request.headers);
  const req = {
    url: url.pathname + url.search,
    method: request.method,
    headers,
    async *[Symbol.asyncIterator]() {
      if (!request.body) return;
      const reader = request.body.getReader(),
        decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield decoder.decode(value, { stream: true });
        }
        yield decoder.decode();
      } finally {
        await reader.cancel();
      }
    },
  };
  const res = {
    status: 200,
    headers: new Headers(),
    setHeader(k, v) {
      this.headers.set(k, v);
    },
    writeHead(s, values = {}) {
      this.status = s;
      for (const [k, v] of Object.entries(values)) this.headers.set(k, v);
      return this;
    },
    end(value = "") {
      this.body = value;
    },
  };
  await middleware(req, res);
  return new Response(res.body ?? "", {
    status: res.status,
    headers: res.headers,
  });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (url.pathname === "/api/health")
      return json(200, { ok: true, runtime: "cloudflare" });
    try {
      const services = environment(env);
      if (url.pathname.startsWith("/api/auth/"))
        return await handleAuth(request, env, services.store);
      if (url.pathname.startsWith("/api/push/"))
        return await bridge(request, services.push.middleware);
      if (url.pathname === "/api/widget")
        return await bridge(request, createWidgetMiddleware({ loadTimetable: services.load }));
      if (url.pathname === "/api/timetable") {
        if (request.method !== "GET")
          return json(405, { error: { message: "GET 요청만 지원합니다." } });
        let range;
        try {
          range = queryRange(url.searchParams);
        } catch {
          return json(400, {
            error: { message: "학년·반·조회 주간을 확인해 주세요." },
          });
        }
        if (url.searchParams.get("refresh") === "1")
          cache.delete(JSON.stringify(range));
        return json(200, await services.load(range));
      }
      return json(404, { error: { message: "페이지를 찾을 수 없습니다." } });
    } catch {
      return json(503, {
        error: {
          message: "서버 연결을 준비 중입니다. 잠시 후 다시 시도해 주세요.",
        },
      });
    }
  },
  scheduled(_event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const services = environment(env);
        await services.push.tick();
        await services.store.cleanup();
      })(),
    );
  },
};
