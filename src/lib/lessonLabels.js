import { thirdGradeTeacher } from "./thirdGradeTeachers.js";
import { secondGradeTeacher } from "./secondGradeTeachers.js";
// 사용자가 제공한 학년별 담당 교사 정보. 나이스 API의 교사 데이터가 아니다.
const TEACHERS = {
  공통수학: "김규봉",
  공통영어: "이경숙",
  통합과학: "최한영",
  통합사회: "허혜진",
  진로활동: "김나영",
  인공지능일반: "송지훈",
  인공지능: "송지훈",
  사물인터넷센서제어: "이진열",
  사물인터넷과센서제어: "이진열",
  디자인일반: "정유진",
  디자인: "정유진",
  IoT: "이진열",
  운영체제: "김현지",
  체육: "설동상",
};
// 2학년 반별 교사 정보는 사용자 제공 표와 대조한다.
const SECOND_GRADE = {
  펌웨어구현: ["펌웨어 구현", null],
  인공지능플랫폼요구사항분석: ["인공지능 플랫폼 요구사항 분석", null],
  인공지능모델학습: ["인공지능 모델학습", null],
  SQL활용: ["데이터 베이스", "박지혜"],
  한국사2: ["한국사", "이혜정"],
  대수: ["대수", "전지영"],
  인공지능모델개발: ["인공지능 모델 개발", "박수진"],
  개발자환경구축: ["운영체제", "김현지"],
  세계문화와영어: ["영어", "차수민"],
  스포츠생활2: ["체육", "설동상"],
  인공지능서비스애플리케이션개발: ["인공지능 서비스 애플리케이션", null],
  인공지능모델선정: ["인공지능 모델 개발", "박수진"],
  인공지능서비스애플리케이션: ["인공지능 서비스 애플리케이션", null],
  컴퓨터네트워크: ["컴퓨터 네트워크", "박건우"],
  진로활동: ["진로 활동", null],
  인공지능서비스운영모니터링: ["인공지능 서비스 운영 모니터링", "박수진"],
  공통국어2: ["공통 국어", "진예빈"],
};
const secondGradeClass = (grade, classroom) =>
  String(grade) === "2" && ["1", "2", "3", "4"].includes(String(classroom));
const subjectKey = (name) => name.replace(/^\*\s*/, "").replace(/\s+/g, "");
export function lessonLabel(subject, grade, classroom) {
  subject = subject.replace(/\[(?:보강|변경|대체)\]\s*/g, "").trim();
  if (secondGradeClass(grade, classroom))
    return SECOND_GRADE[subjectKey(subject)]?.[0] ?? subject;
  if (String(grade) !== "1") return subject;
  const clean = subject.replace(/^\*\s*/, "").trim();
  const compact = clean.replace(/\s+/g, "");
  if (/^(개발자환경구축|IT시스템서버운영관리)$/.test(compact))
    return "운영체제";
  const label = clean.replace(/\s*2$/, "").trim();
  const aliases = {
    사물인터넷센서제어: "IoT",
    사물인터넷과센서제어: "IoT",
    알고리즘설계: "알고리즘",
    디자인일반: "디자인",
    인공지능일반: "인공지능",
  };
  return aliases[label.replace(/\s+/g, "")] ?? label;
}
export function lessonTeacher(
  name,
  { grade, classroom, day, period, sourceName },
) {
  if (String(grade) === "3")
    return thirdGradeTeacher(sourceName ?? name, classroom, day, period);
  if (secondGradeClass(grade, classroom)) {
    const entry = Object.values(SECOND_GRADE).find(
      ([label]) => subjectKey(label) === subjectKey(name),
    );
    const referenceTeacher = secondGradeTeacher(name, classroom, day, period);
    return referenceTeacher === undefined
      ? (entry?.[1] ?? null)
      : referenceTeacher;
  }
  if (String(grade) !== "1") return null;
  const compact = name.replace(/\s+/g, "");
  if (compact === "알고리즘설계" || compact === "알고리즘") {
    const classNumber = String(classroom);
    if (["2", "3", "4"].includes(classNumber)) {
      const isKim =
        (classNumber === "2" && day === 3 && period === 4) ||
        (classNumber === "3" && day === 0) ||
        (classNumber === "4" && day === 4 && period === 1);
      return isKim ? "김미영" : "염혜린";
    }
    if (classNumber !== "1") return null;
    if ((day === 0 && [2, 3].includes(period)) || (day === 4 && period === 4))
      return "염혜린";
    if (day === 3 && period === 7) return "김미영";
    return null;
  }
  return TEACHERS[compact] ?? null;
}
