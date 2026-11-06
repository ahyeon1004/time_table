import { createHash, randomBytes } from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
export function createWidgetAccounts({db,store,origin,now=Date.now}) {
 let ready;
 const init=()=>ready??=(db.prepare('CREATE TABLE IF NOT EXISTS widget_accounts (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, session_token TEXT NOT NULL, expires BIGINT NOT NULL)').run().catch(e=>{ready=null;throw e;}));
 return {
  async create(session) {
   const user=await store.user(session);
   if(!user)return {status:401,error:'로그인이 필요합니다.'};
   if(!user.profile)return {status:409,error:'학년과 반을 먼저 등록해 주세요.'};
   await init();
   await db.prepare('DELETE FROM widget_accounts WHERE expires<=?').bind(now()).run();
   const count=await db.prepare('SELECT count(*) AS n FROM widget_accounts WHERE user_id=?').bind(user.id).first();
   if(Number(count.n)>=10)return {status:409,error:'기존 위젯 연결을 해제한 뒤 새 코드를 만들어 주세요.'};
   const code=randomBytes(32).toString('base64url');
   await db.prepare('INSERT INTO widget_accounts VALUES (?,?,?,?)').bind(hash(code),user.id,hash(session),now()+90*86400000).run();
   return {status:200,code,profile:{grade:user.profile.grade,classroom:user.profile.classroom}};
  },
  async revoke(session) {
   const user=await store.user(session);if(!user)return false;
   await init();await db.prepare('DELETE FROM widget_accounts WHERE user_id=?').bind(user.id).run();return true;
  },
  async resolve(request) {
   const match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get('authorization')||'');
   if(!match)return null;
   const code=match[1];
   await init();
   const row=await db.prepare('SELECT users.profile FROM widget_accounts JOIN users ON users.id=widget_accounts.user_id JOIN sessions ON sessions.token=widget_accounts.session_token AND sessions.user_id=widget_accounts.user_id WHERE widget_accounts.token=? AND widget_accounts.expires>? AND sessions.expires>?').bind(hash(code),now(),now()).first();
   if(!row?.profile)return null;
   const p=JSON.parse(row.profile);
   return /^[1-3]$/.test(p.grade)&&/^[1-4]$/.test(p.classroom)?{grade:p.grade,classroom:p.classroom}:null;
  },
  sameOrigin(request){return request.headers.get('origin')===origin;}
 };
}
