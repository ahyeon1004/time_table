import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createScheduler, authorizedScheduler } from "./scheduler.js";

test("예약 호출은 인증하고 성공·실패 이력을 DB에 보존한다", async t => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  const statement = (source, values=[]) => ({
    bind: (...args) => statement(source,args),
    async run() { return sqlite.prepare(source).run(...values); },
    async first() { return sqlite.prepare(source).get(...values) ?? null; },
  });
  const db = { prepare: source => statement(source) };
  let time = 1000000, failed = false;
  const scheduler = createScheduler({db,now:()=>time,dispatch:async()=>({devices:1,sent:failed?0:1,failed:failed?1:0})});
  assert.equal(authorizedScheduler(new Request("https://example.com"), "secret"),false);
  assert.equal(authorizedScheduler(new Request("https://example.com", {headers:{Authorization:"Bearer secret"}}), "secret"),true);
  assert.equal(authorizedScheduler(new Request("https://example.com", {headers:{Authorization:"Bearer secret"}}), ""),false);
  assert.equal(await scheduler.status(),null);
  assert.equal((await scheduler.run()).sent,1);
  const previous = (await scheduler.status()).lastSuccessAt;
  time+=60000;failed=true;
  await assert.rejects(scheduler.run(),/failed/);
  assert.equal((await scheduler.status()).lastSuccessAt,previous);
  assert.equal((await scheduler.status()).failed,1);
  failed=false;
  await scheduler.run();
  const restarted = createScheduler({db,dispatch:async()=>null});
  assert.equal((await restarted.status()).lastSuccessAt,new Date(time).toISOString());
});
