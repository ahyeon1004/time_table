import { neon } from "@neondatabase/serverless";
import worker from "../edge/worker.js";
import { environment as services } from "../edge/worker.js";
import { authorizedScheduler, createScheduler } from "../server/scheduler.js";
import { postgresDatabase } from "../server/postgres.js";

let configured, scheduler;
function schedulerFor(env) {
  scheduler ??= createScheduler({ db: env.DB, dispatch: () => services(env).push.tick() });
  return scheduler;
}
function environment() {
  if (!configured) configured = {
    ...process.env,
    DB: process.env.DATABASE_URL
      ? postgresDatabase(neon(process.env.DATABASE_URL)) : undefined,
  };
  return configured;
}

export default {
  async fetch(request) {
    // Reuse the same auth, timetable and push routes on both deployment targets.
    if (new URL(request.url).pathname === "/api/health")
      return Response.json({ ok: true, runtime: "vercel" }, {
        headers: { "Cache-Control": "no-store" },
      });
    const env = environment();
    const path = new URL(request.url).pathname;
    if (["/api/push/dispatch", "/api/push/scheduler"].includes(path)) {
      if (!authorizedScheduler(request, env.CRON_SECRET))
        return new Response("Unauthorized", { status: 401 });
      if (request.method !== "POST" && request.method !== "GET")
        return new Response("Method not allowed", { status: 405 });
      try {
        if (path.endsWith("/scheduler"))
          return Response.json(await schedulerFor(env).status(), { headers: { "Cache-Control": "no-store" } });
        const result = await schedulerFor(env).run();
        await services(env).store.cleanup();
        return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
      } catch {
        console.error("Scheduled notification dispatch failed");
        return Response.json({ error: "일정 알림을 처리하지 못했습니다." }, { status: 503 });
      }
    }
    const response = await worker.fetch(request, env);
    if (path === "/api/push/config" && response.ok) {
      const status = env.DB ? await schedulerFor(env).status() : null;
      return Response.json({ ...await response.json(),
        schedulingReady: env.PUSH_SCHEDULER_ENABLED === "true" && !!status?.lastSuccessAt,
        schedulerLastSuccessAt: status?.lastSuccessAt ?? null,
      }, { headers: { "Cache-Control": "no-store" } });
    }
    return response;
  },
};
