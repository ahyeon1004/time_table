import { normalizeTimetable } from '../src/lib/timetable.js';
import { createSchedule, dateKey, mondayOf, parseDate, timeLabel } from '../src/lib/schedule.js';

export function widgetDate(now=new Date()) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(x=>[x.type,x.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function widgetQuery(params,now) {
  const grade=params.get('grade'), classroom=params.get('classroom'), key=params.get('date')||widgetDate(now);
  if(!/^[1-3]$/.test(grade??'')||!/^[1-4]$/.test(classroom??'')||!/^20\d{2}-\d{2}-\d{2}$/.test(key))throw new Error('invalid');
  const date=parseDate(key);
  if(dateKey(date)!==key)throw new Error('invalid');
  const week=mondayOf(date);const friday=new Date(week);friday.setDate(friday.getDate()+4);
  return {grade,classroom,key,date,week,range:{grade,classroom,from:dateKey(week),to:dateKey(friday)}};
}
export function createWidgetMiddleware({loadTimetable,now=()=>new Date()}) {
  return async(req,res,next)=>{
    const url=new URL(req.url,'http://localhost');if(url.pathname!=='/api/widget')return next?.();
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    if(req.method!=='GET')return json(405,{error:{message:'GET 요청만 지원합니다.'}});
    let query;
    try{query=widgetQuery(url.searchParams,now());}catch{return json(400,{error:{message:'위젯의 학년·반·날짜를 확인해 주세요.'}});}
    try {
      const payload=await loadTimetable(query.range);
      const timetable=normalizeTimetable(payload,{grade:query.grade,classroom:query.classroom,week:query.week});
      const slots=createSchedule(null,timetable.maxPeriods).periods;
      const lessons=(timetable.byDate[query.key]??[]).flatMap((lesson,i)=>lesson?[{period:i+1,name:lesson.name,teacher:lesson.teacher,start:timeLabel(slots[i].start),end:timeLabel(slots[i].end)}]:[]);
      return json(200,{date:query.key,grade:query.grade,classroom:query.classroom,source:'NEIS',fetchedAt:payload.fetchedAt,usesDefaultBellTimes:true,lessons});
    }catch{return json(502,{error:{message:'학교 시간표를 불러오지 못했습니다.'}});}
  };
}
