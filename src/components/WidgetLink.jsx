import {useState} from 'react';
import {Button} from './ui.jsx';
export function WidgetLink() {
 const [code,setCode]=useState(''),[profile,setProfile]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function change(method) {
  setBusy(true);setMessage('');
  try {
   const response=await fetch('/api/widget/link',{method,credentials:'same-origin'});
   const body=await response.json();
   if(!response.ok)throw Error(body.error?.message||'연결을 처리하지 못했습니다.');
   setCode(body.code||'');setProfile(body.profile||null);
   setMessage(method==='DELETE'?'이 계정의 위젯 연결을 모두 해제했어요.':'위젯 편집에서 연결 코드를 한 번 입력해 주세요.');
  }catch(error){setMessage(error.message);}finally{setBusy(false);}
 }
 return <section className="notification-controls device-notification-controls" aria-labelledby="widget-link-title">
  <h2 id="widget-link-title">맥 시간표 위젯</h2>
  <p>학교 계정에 등록한 학년·반을 위젯과 연결해요.</p>
  <p className="notification-permission-help">코드를 만든 뒤 맥 위젯 우클릭 → 위젯 편집 → 위젯 연결 코드에 붙여 넣으세요. 이후 학년·반 변경은 자동 반영돼요. 로그아웃하면 연결이 해제돼요.</p>
  <div className="device-notification-actions">
   <Button disabled={busy} onClick={()=>change('POST')}>{busy?'처리 중…':'위젯 연결 코드 만들기'}</Button>
   <Button variant="secondary" disabled={busy} onClick={()=>change('DELETE')}>모든 위젯 연결 해제</Button>
  </div>
  {code&&<div>
   <p>{profile.grade}학년 {profile.classroom}반으로 연결해요.</p>
   <input aria-label="위젯 연결 코드" type="password" value={code} readOnly autoComplete="off" onFocus={e=>e.target.select()}/>
   <Button variant="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(code);setMessage('코드를 복사했어요. 위젯 편집에 붙여 넣으세요.');}catch{setMessage('코드 입력칸을 선택해서 직접 복사해 주세요.');}}}>코드 복사</Button>
   <p className="notification-permission-help">이 코드는 학년·반 시간표 조회용이에요. 다른 사람에게 공유하지 마세요. 이 화면을 떠나면 다시 표시되지 않아요.</p>
  </div>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
