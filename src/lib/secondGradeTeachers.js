// 사용자가 제공한 8/24 시간표의 2학년 반별 배정. 날짜별 변경을 자동 반영하지 않는다.
const FULL_NAMES = {
  박지: "박지혜",
  진예: "진예빈",
  이혜: "이혜정",
  김현: "김현지",
  박건: "박건우",
  설동: "설동상",
  조유: "조유진",
  차수: "차수민",
  전지: "전지영",
  박수: "박수진",
  필립: "필립",
  박제: "박제현",
  최병: "최병준",
  이세: "이세준",
  이나: "이나영",
};
const SUBJECTS = {
  데이터베이스: "데베",
  SQL활용: "데베",
  공통국어: "국어",
  한국사: "국사",
  대수: "대수",
  운영체제: "운영",
  영어: "영어",
  체육: "스포츠",
  컴퓨터네트워크: "컴네",
  진로활동: "진로",
  인공지능서비스애플리케이션: "인서",
  인공지능서비스애플리케이션개발: "인서",
  인공지능플랫폼인프라구현: "인플",
  임베디드SW아키텍처설계: "산업",
  인공지능모델개발: "인모",
  인공지능모델선정: "인모",
  인공지능서비스운영모니터링: "인모",
};
const REFERENCE = {
  1: [
    { day: 0, period: 1, subject: "데베", teacher: "박지" },
    { day: 0, period: 2, subject: "국어", teacher: "진예" },
    { day: 0, period: 3, subject: "국사", teacher: "이혜" },
    { day: 0, period: 4, subject: "대수", teacher: "전지" },
    { day: 0, period: 5, subject: "인서", teacher: "안정" },
    { day: 0, period: 6, subject: "인서", teacher: "안정" },
    { day: 0, period: 7, subject: "인서", teacher: "안정" },
    { day: 1, period: 1, subject: "운영", teacher: "김현" },
    { day: 1, period: 2, subject: "운영", teacher: "김현" },
    { day: 1, period: 3, subject: "영어A", teacher: "차수" },
    { day: 1, period: 4, subject: "스포츠", teacher: "설동" },
    { day: 1, period: 5, subject: "인서", teacher: "안정" },
    { day: 1, period: 6, subject: "인서", teacher: "안정" },
    { day: 1, period: 7, subject: "인서", teacher: "안정" },
    { day: 2, period: 1, subject: "국사", teacher: "이혜" },
    { day: 2, period: 2, subject: "스포츠", teacher: "설동" },
    { day: 2, period: 3, subject: "대수", teacher: "전지" },
    { day: 2, period: 4, subject: "컴네", teacher: "박건" },
    { day: 2, period: 5, subject: "컴네", teacher: "박건" },
    { day: 2, period: 6, subject: "컴네", teacher: "박건" },
    { day: 3, period: 1, subject: "대수", teacher: "전지" },
    { day: 3, period: 2, subject: "진로", teacher: "박근" },
    { day: 3, period: 3, subject: "인모", teacher: "박수" },
    { day: 3, period: 4, subject: "인모", teacher: "박수" },
    { day: 3, period: 5, subject: "인모", teacher: "박수" },
    { day: 3, period: 6, subject: "국어", teacher: "김수" },
    { day: 3, period: 7, subject: "영어A", teacher: "차수" },
    { day: 4, period: 1, subject: "영어B", teacher: "필립" },
    { day: 4, period: 2, subject: "국사", teacher: "이혜" },
    { day: 4, period: 3, subject: "국어", teacher: "김수" },
    { day: 4, period: 4, subject: "데베", teacher: "박제" },
  ],
  2: [
    { day: 0, period: 1, subject: "컴네", teacher: "박건" },
    { day: 0, period: 2, subject: "컴네", teacher: "박건" },
    { day: 0, period: 3, subject: "컴네", teacher: "박건" },
    { day: 0, period: 4, subject: "국어", teacher: "진예" },
    { day: 0, period: 5, subject: "인활", teacher: "조유" },
    { day: 0, period: 6, subject: "인활", teacher: "조유" },
    { day: 0, period: 7, subject: "인활", teacher: "조유" },
    { day: 1, period: 1, subject: "스포츠", teacher: "설동" },
    { day: 1, period: 2, subject: "대수", teacher: "전지" },
    { day: 1, period: 3, subject: "국사", teacher: "이혜" },
    { day: 1, period: 4, subject: "영어A", teacher: "차수" },
    { day: 1, period: 5, subject: "인활", teacher: "조유" },
    { day: 1, period: 6, subject: "인활", teacher: "조유" },
    { day: 1, period: 7, subject: "인활", teacher: "조유" },
    { day: 2, period: 1, subject: "영어A", teacher: "차수" },
    { day: 2, period: 2, subject: "국사", teacher: "이혜" },
    { day: 2, period: 3, subject: "진로", teacher: "박근" },
    { day: 2, period: 4, subject: "대수", teacher: "전지" },
    { day: 2, period: 5, subject: "스포츠", teacher: "설동" },
    { day: 2, period: 6, subject: "영어B", teacher: "필립" },
    { day: 3, period: 1, subject: "국어", teacher: "김수" },
    { day: 3, period: 2, subject: "인모", teacher: "박지" },
    { day: 3, period: 3, subject: "인모", teacher: "박지" },
    { day: 3, period: 4, subject: "인모", teacher: "박지" },
    { day: 3, period: 5, subject: "대수", teacher: "전지" },
    { day: 3, period: 6, subject: "국사", teacher: "이혜" },
    { day: 3, period: 7, subject: "데베", teacher: "박제" },
    { day: 4, period: 1, subject: "국어", teacher: "김수" },
    { day: 4, period: 2, subject: "데베", teacher: "박지" },
    { day: 4, period: 3, subject: "운영", teacher: "김현" },
    { day: 4, period: 4, subject: "운영", teacher: "김현" },
  ],
  3: [
    { day: 0, period: 1, subject: "대수", teacher: "전지" },
    { day: 0, period: 2, subject: "국사", teacher: "이혜" },
    { day: 0, period: 3, subject: "데베", teacher: "박지" },
    { day: 0, period: 4, subject: "영어A", teacher: "차수" },
    { day: 0, period: 5, subject: "인플", teacher: "최병" },
    { day: 0, period: 6, subject: "인플", teacher: "최병" },
    { day: 0, period: 7, subject: "인플", teacher: "최병" },
    { day: 1, period: 1, subject: "국사", teacher: "이혜" },
    { day: 1, period: 2, subject: "스포츠", teacher: "설동" },
    { day: 1, period: 3, subject: "국어", teacher: "진예" },
    { day: 1, period: 4, subject: "대수", teacher: "전지" },
    { day: 1, period: 5, subject: "인플", teacher: "최병" },
    { day: 1, period: 6, subject: "인플", teacher: "최병" },
    { day: 1, period: 7, subject: "인플", teacher: "최병" },
    { day: 2, period: 1, subject: "스포츠", teacher: "설동" },
    { day: 2, period: 2, subject: "진로", teacher: "박근" },
    { day: 2, period: 3, subject: "컴네", teacher: "이나" },
    { day: 2, period: 4, subject: "컴네", teacher: "이나" },
    { day: 2, period: 5, subject: "컴네", teacher: "이나" },
    { day: 2, period: 6, subject: "국어", teacher: "진예" },
    { day: 3, period: 1, subject: "운영", teacher: "김현" },
    { day: 3, period: 2, subject: "운영", teacher: "김현" },
    { day: 3, period: 3, subject: "국어", teacher: "김수" },
    { day: 3, period: 4, subject: "데베", teacher: "박제" },
    { day: 3, period: 5, subject: "영어A", teacher: "차수" },
    { day: 3, period: 6, subject: "대수", teacher: "전지" },
    { day: 3, period: 7, subject: "국사", teacher: "이혜" },
    { day: 4, period: 1, subject: "인모", teacher: "박수" },
    { day: 4, period: 2, subject: "인모", teacher: "박수" },
    { day: 4, period: 3, subject: "인모", teacher: "박수" },
    { day: 4, period: 4, subject: "영어B", teacher: "필립" },
  ],
  4: [
    { day: 0, period: 1, subject: "영어A", teacher: "차수" },
    { day: 0, period: 2, subject: "대수", teacher: "전지" },
    { day: 0, period: 3, subject: "진로", teacher: "박근" },
    { day: 0, period: 4, subject: "데베", teacher: "박제" },
    { day: 0, period: 5, subject: "산업", teacher: "이세" },
    { day: 0, period: 6, subject: "산업", teacher: "이세" },
    { day: 0, period: 7, subject: "산업", teacher: "이세" },
    { day: 1, period: 1, subject: "대수", teacher: "전지" },
    { day: 1, period: 2, subject: "인모", teacher: "박지" },
    { day: 1, period: 3, subject: "인모", teacher: "박지" },
    { day: 1, period: 4, subject: "인모", teacher: "박지" },
    { day: 1, period: 5, subject: "국사", teacher: "이혜" },
    { day: 1, period: 6, subject: "스포츠", teacher: "설동" },
    { day: 1, period: 7, subject: "영어B", teacher: "필립" },
    { day: 2, period: 1, subject: "데베", teacher: "박지" },
    { day: 2, period: 2, subject: "국어", teacher: "진예" },
    { day: 2, period: 3, subject: "영어A", teacher: "차수" },
    { day: 2, period: 4, subject: "국사", teacher: "이혜" },
    { day: 2, period: 5, subject: "운영", teacher: "김현" },
    { day: 2, period: 6, subject: "운영", teacher: "김현" },
    { day: 3, period: 1, subject: "컴네", teacher: "이나" },
    { day: 3, period: 2, subject: "컴네", teacher: "이나" },
    { day: 3, period: 3, subject: "컴네", teacher: "이나" },
    { day: 3, period: 4, subject: "국어", teacher: "김수" },
    { day: 3, period: 5, subject: "산업", teacher: "이세" },
    { day: 3, period: 6, subject: "산업", teacher: "이세" },
    { day: 3, period: 7, subject: "산업", teacher: "이세" },
    { day: 4, period: 1, subject: "국사", teacher: "이혜" },
    { day: 4, period: 2, subject: "스포츠", teacher: "설동" },
    { day: 4, period: 3, subject: "대수", teacher: "전지" },
    { day: 4, period: 4, subject: "국어", teacher: "김수" },
  ],
};
const category = (subject) =>
  subject === "영어A" || subject === "영어B"
    ? "영어"
    : subject === "인활"
      ? "인서"
      : subject;
export function secondGradeTeacher(name, classroom, day, period) {
  const key = name.replace(/^\*\s*/, "").replace(/\s+/g, "");
  // 사용자 최신 정정: 2학년 2반 월요일 모델학습 담당.
  if (key === "인공지능모델학습" && String(classroom) === "2" && day === 0)
    return "조유진";
  if (key === "인공지능플랫폼요구사항분석" && String(classroom) === "3")
    return "최병준";
  if (key === "영어" && String(classroom) === "3" && day === 1 && period === 3)
    return "차수민";
  if (key === "펌웨어구현" && String(classroom) === "4" && day === 0)
    return "이세준";
  const subject = SUBJECTS[key];
  if (!subject) return undefined;
  if (
    String(classroom) === "1" &&
    day === 0 &&
    period === 2 &&
    subject === "데베"
  )
    return "박지혜";
  // 사용자 최신 정정: 해당 수업이 데이터베이스인 경우에만 적용한다.
  if (
    String(classroom) === "2" &&
    day === 0 &&
    period === 4 &&
    subject === "데베"
  )
    return "박제현";
  const lessons = (REFERENCE[String(classroom)] ?? []).filter(
    (row) => category(row.subject) === subject,
  );
  const slot = lessons.find((row) => row.day === day && row.period === period);
  const candidates = [...new Set(lessons.map((row) => row.teacher))];
  const short =
    slot?.teacher ?? (candidates.length === 1 ? candidates[0] : null);
  return short ? (FULL_NAMES[short] ?? short) : null;
}
