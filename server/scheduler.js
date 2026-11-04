import { createHash, timingSafeEqual } from "node:crypto";

const digest = value => createHash("sha256").update(value).digest();
export function authorizedScheduler(request, secret) {
  return !!secret && timingSafeEqual(digest(request.headers.get("authorization") || ""), digest(`Bearer ${secret}`));
}

export function createScheduler({ db, dispatch, now = Date.now }) {
  let initialized;
  function initialize() {
    initialized ??= db.prepare("CREATE TABLE IF NOT EXISTS scheduler_status (id TEXT PRIMARY KEY, attempted_at BIGINT NOT NULL, succeeded_at BIGINT, sent INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0)").run().catch(error => {
      initialized = null;
      throw error;
    });
    return initialized;
  }
  return {
    async run() {
      await initialize();
      await db.prepare("INSERT INTO scheduler_status (id,attempted_at) VALUES ('primary',?) ON CONFLICT(id) DO UPDATE SET attempted_at=excluded.attempted_at").bind(now()).run();
      const result = await dispatch();
      if (!result) throw new Error("Scheduler unavailable");
      if (result.failed > 0) {
        await db.prepare("UPDATE scheduler_status SET sent=?,failed=? WHERE id='primary'").bind(result.sent, result.failed).run();
        throw new Error("Some notifications failed");
      }
      await db.prepare("UPDATE scheduler_status SET succeeded_at=?,sent=?,failed=0 WHERE id='primary'").bind(now(), result.sent).run();
      return result;
    },
    async status() {
      try {
        const row = await db.prepare("SELECT attempted_at,succeeded_at,sent,failed FROM scheduler_status WHERE id='primary'").first();
        return row ? {
          lastRunAt: new Date(Number(row.attempted_at)).toISOString(),
          lastSuccessAt: row.succeeded_at ? new Date(Number(row.succeeded_at)).toISOString() : null,
          sent: Number(row.sent), failed: Number(row.failed),
        } : null;
      } catch { return null; }
    },
  };
}
