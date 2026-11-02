import { neon } from "@neondatabase/serverless";
import worker from "../edge/worker.js";
import { environment as services } from "../edge/worker.js";
import { createHash, timingSafeEqual } from "node:crypto";
import { postgresDatabase } from "../server/postgres.js";

let configured;
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
    if (path === "/api/push/dispatch") {
      const digest = (s) => createHash("sha256").update(s).digest();
      if (!env.CRON_SECRET || !timingSafeEqual(
        digest(request.headers.get("authorization") || ""),
        digest(`Bearer ${env.CRON_SECRET}`),
      )) return new Response("Unauthorized", { status: 401 });
      if (request.method !== "POST" && request.method !== "GET")
        return new Response("Method not allowed", { status: 405 });
      try {
        await services(env).push.tick();
        await services(env).store.cleanup();
        return Response.json({ ok: true });
      } catch {
        console.error("Scheduled notification dispatch failed");
        return Response.json({ error: "일정 알림을 처리하지 못했습니다." }, { status: 503 });
      }
    }
    const response = await worker.fetch(request, env);
    if (path === "/api/push/config" && response.ok) {
      return Response.json({ ...await response.json(),
        schedulingReady: env.PUSH_SCHEDULER_ENABLED === "true",
      }, { headers: { "Cache-Control": "no-store" } });
    }
    return response;
  },
};
