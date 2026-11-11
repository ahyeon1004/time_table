import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {edgeStore} from '../edge/store.js';
import {createWidgetAccounts} from './widget-account.js';
import worker from '../edge/worker.js';
test('계정 위젯은 2·3학년 반을 분리하고 프로필 변경·해제·로그아웃·만료를 반영한다',async t=>{
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());
 sql.exec(await readFile(new URL('../migrations/0001_auth.sql',import.meta.url),'utf8'));
 const stmt=(q,args=[])=>({bind:(...a)=>stmt(q,a),async run(){return sql.prepare(q).run(...args)},async first(){return sql.prepare(q).get(...args)??null}});
 const db={prepare:q=>stmt(q),async batch(ss){for(const s of ss)await s.run()}};
 const store=edgeStore(db);const now=Date.now();let clock=now;
 const accounts=createWidgetAccounts({db,store,origin:'https://school.test',now:()=>clock});
 assert.equal((await accounts.create()).status,401);
 for(const [id,grade,classroom] of [['one','2','2'],['two','3','4']]){
  await store.login({sub:id,email:id+'@bssm.hs.kr'},id,now+86400000);
  await store.profile(id,{grade,classroom,number:'1'});
 }
 const one=await accounts.create('one'),two=await accounts.create('two');
 const req=code=>new Request('https://school.test/api/widget',{headers:{Authorization:'Bearer '+code}});
 assert.deepEqual(await accounts.resolve(req(one.code)),{grade:'2',classroom:'2'});
 assert.deepEqual(await accounts.resolve(req(two.code)),{grade:'3',classroom:'4'});
 assert.equal(await accounts.resolve(req('x'.repeat(43))),null);
 assert.equal(sql.prepare('SELECT token FROM widget_accounts WHERE token=?').get(one.code),undefined);
 await store.profile('one',{grade:'2',classroom:'3',number:'1'});
 assert.deepEqual(await accounts.resolve(req(one.code)),{grade:'2',classroom:'3'});
 await accounts.revoke('one');assert.equal(await accounts.resolve(req(one.code)),null);
 assert.deepEqual(await accounts.resolve(req(two.code)),{grade:'3',classroom:'4'});
 await store.logout('two');assert.equal(await accounts.resolve(req(two.code)),null);
 const renewed=await accounts.create('one');clock=now+91*86400000;assert.equal(await accounts.resolve(req(renewed.code)),null);
 const upstreamClasses=[];
 t.mock.method(globalThis,'fetch',async url=>{
  const params=new URL(url).searchParams;
  upstreamClasses.push([params.get('GRADE'),params.get('CLASS_NM')]);
  return Response.json({RESULT:{CODE:'INFO-200'}});
 });
 const env={DB:db,APP_ORIGIN:'https://school.test',NEIS_API_KEY:'test'};
 const timetableRequest=(code,date)=>new Request('https://school.test/api/widget?date='+date,{headers:{Authorization:'Bearer '+code}});
 for(const [classroom,date] of [['3','2026-11-11'],['4','2026-11-12']]){
  await store.profile('one',{grade:'2',classroom,number:'1'});
  const response=await worker.fetch(timetableRequest(renewed.code,date),env);
  assert.equal(response.status,200);
  const day=await response.json();
  assert.deepEqual([day.grade,day.classroom,day.date],['2',classroom,date]);
 }
 assert.deepEqual(upstreamClasses,[['2','3'],['2','4']]);
 await store.profile('one',{grade:'2',classroom:'3',number:'1'});
 const csrf=await worker.fetch(new Request('https://school.test/api/widget/link',{method:'POST',headers:{Origin:'https://attacker.test',Cookie:'bssm_session=one'}}),env);
 assert.equal(csrf.status,403);
 const linked=await worker.fetch(new Request('https://school.test/api/widget/account',{headers:{Authorization:'Bearer '+renewed.code}}),env);
 assert.equal(linked.status,200);assert.deepEqual(await linked.json(),{profile:{grade:'2',classroom:'3'}});
 const loggedOut=await worker.fetch(req(two.code),env);assert.equal(loggedOut.status,401);
});
