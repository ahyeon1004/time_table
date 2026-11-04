// Run locally with: node --env-file=.env.scheduler.local server/setup-schedule.mjs
// Never put tokens in CLI arguments, source control, or the destination URL.
const destination = "https://bssm-timetable.vercel.app/api/push/dispatch";
const { QSTASH_TOKEN, CRON_SECRET } = process.env;
if (!QSTASH_TOKEN || !CRON_SECRET) throw new Error("QSTASH_TOKEN and CRON_SECRET are required");
const base = process.env.QSTASH_URL || "https://qstash.upstash.io";
if (!/^https:\/\/[a-z0-9-]+\.upstash\.io$/.test(base)) throw new Error("Invalid QSTASH_URL");
const response = await fetch(`${base}/v2/schedules/${destination}`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${QSTASH_TOKEN}`,
    "Upstash-Cron": "CRON_TZ=Asia/Seoul * 7-19 * * 1-5",
    "Upstash-Schedule-Id": "bssm-school-notifications",
    "Upstash-Method": "POST",
    "Upstash-Forward-Authorization": `Bearer ${CRON_SECRET}`,
    "Upstash-Retries": "1",
    "Upstash-Timeout": "55s",
    "Content-Type": "application/json",
  },
  body: "{}",
  signal: AbortSignal.timeout(20000),
});
if (!response.ok) throw new Error(`Schedule setup failed (${response.status})`);
const result = await response.json();
console.log(JSON.stringify({ scheduleId: result.scheduleId, destination,
  timezone: "Asia/Seoul", weekdays: "Monday–Friday", hours: "07:00–19:59", interval: "1 minute" }));
