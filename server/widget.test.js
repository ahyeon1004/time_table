import test from 'node:test';
import assert from 'node:assert/strict';
import {createWidgetMiddleware} from './widget.js';
test('위젯은 웹과 같은 과목·교사·시각을 반환하고 잘못된 조회와 통신 실패를 구분한다',async()=>{
 const call=async(m,url)=>{let status,body;await m({method:'GET',url},{writeHead:s=>status=s,end:s=>body=JSON.parse(s)});return {status,body};};
 const m=createWidgetMiddleware({loadTimetable:async r=>({source:'NEIS',...r,rows:[{date:'2026-11-06',period:1,content:'통합과학2'}]})});
 const result=await call(m,'/api/widget?grade=1&classroom=1&date=2026-11-06');
 assert.equal(result.status,200);assert.deepEqual(result.body.lessons,[{period:1,name:'통합과학',teacher:'최한영',start:'08:40',end:'09:30'}]);
 assert.equal((await call(m,'/api/widget?grade=9&classroom=1')).status,400);
 assert.equal((await call(m,'/api/widget?grade=1&classroom=1&date=2026-02-30')).status,400);
 assert.equal((await call(createWidgetMiddleware({loadTimetable:async()=>{throw Error('private upstream secret')}}),'/api/widget?grade=1&classroom=1')).status,502);
});
