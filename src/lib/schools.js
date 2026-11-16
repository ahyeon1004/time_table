export const BSSM = Object.freeze({
  office: "C10",
  code: "7150658",
  name: "부산소프트웨어마이스터고등학교",
  kind: "고등학교",
});

export const SCHOOL_TYPES = Object.freeze({
  초등학교: { endpoint: "elsTimetable", grades: 6 },
  중학교: { endpoint: "misTimetable", grades: 3 },
  고등학교: { endpoint: "hisTimetable", grades: 3 },
  특수학교: { endpoint: "spsTimetable", grades: 6 },
});

export const schoolType = (kind) => Object.hasOwn(SCHOOL_TYPES, kind) ? SCHOOL_TYPES[kind] : null;
export const isBssm = (school = BSSM) => school.office === BSSM.office && school.code === BSSM.code;
export const schoolKey = (school = BSSM) => school.office + ":" + school.code + ":" + school.kind;

export function schoolIdentity(value) {
  if (!value || typeof value.office !== "string" || typeof value.code !== "string"
    || !/^[A-Z]\d{2}$/.test(value.office) || !/^\d{7}$/.test(value.code)
    || !schoolType(value.kind)) return null;
  return { office: value.office, code: value.code, kind: value.kind };
}

export function validClass(grade, classroom, school = BSSM) {
  return typeof grade === "string" && /^[1-6]$/.test(grade)
    && Number(grade) <= (schoolType(school.kind)?.grades ?? 0)
    && typeof classroom === "string" && /^[1-9]\d?$/.test(classroom);
}
