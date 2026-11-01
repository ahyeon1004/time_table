import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

export const SCHOOL = Object.freeze({
  office: "C10",
  code: "7150658",
  name: "부산소프트웨어마이스터고등학교",
});
const TTL = 5 * 60 * 1000;

export class TimetableError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
export async function readApiKey(root = process.cwd()) {
  if (process.env.NEIS_API_KEY?.trim()) return process.env.NEIS_API_KEY.trim();
  try {
    const content = await readFile(resolve(root, ".env.local"), "utf8");
    const match = content.match(
      /^\s*(?:export\s+)?NEIS_API_KEY\s*=\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^#\r\n]*))/m,
    );
    return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}
export function queryRange(params) {
  const grade = params.get("grade"),
    classroom = params.get("classroom"),
    week = params.get("week");
  if (
    !/^[1-3]$/.test(grade ?? "") ||
    !/^[1-9]\d?$/.test(classroom ?? "") ||
    !/^20\d{2}-\d{2}-\d{2}$/.test(week ?? "")
  ) {
    throw new TimetableError(
      "INVALID_QUERY",
      "학년·반·조회할 주간을 확인해 주세요.",
      400,
    );
  }
  const date = new Date(`${week}T00:00:00Z`);
  if (
    Number.isNaN(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== week ||
    date.getUTCDay() !== 1
  ) {
    throw new TimetableError(
      "INVALID_QUERY",
      "조회 시작일은 올바른 월요일 날짜여야 합니다.",
      400,
    );
  }
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + 4);
  return { grade, classroom, from: week, to: end.toISOString().slice(0, 10) };
}
export function parseNeisResponse(payload, range) {
  const status =
    payload.RESULT ??
    payload.hisTimetable?.[0]?.head?.find((entry) => entry.RESULT)?.RESULT;
  if (status?.CODE === "INFO-200") return [];
  if (status?.CODE !== "INFO-000")
    throw new TimetableError(
      "NEIS_REJECTED",
      "나이스 조회에 실패했습니다. 인증키와 서비스 상태를 확인해 주세요.",
    );
  const rows = payload.hisTimetable?.[1]?.row;
  const total = payload.hisTimetable?.[0]?.head?.find(
    (entry) => "list_total_count" in entry,
  )?.list_total_count;
  if (
    !Array.isArray(rows) ||
    !Number.isInteger(total) ||
    rows.length !== total
  ) {
    throw new TimetableError(
      "NEIS_INCOMPLETE",
      "시간표가 일부만 조회되었습니다. 유효한 나이스 인증키를 확인해 주세요.",
    );
  }
  const result = [];
  for (const row of rows) {
    const compact = String(row.ALL_TI_YMD ?? "");
    if (!/^\d{8}$/.test(compact))
      throw new TimetableError(
        "NEIS_FORMAT",
        "시간표 날짜 형식을 확인할 수 없습니다.",
      );
    const date = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
    const period = Number(row.PERIO);
    if (
      row.SD_SCHUL_CODE !== SCHOOL.code ||
      row.ATPT_OFCDC_SC_CODE !== SCHOOL.office ||
      String(row.GRADE) !== range.grade ||
      String(row.CLASS_NM) !== range.classroom ||
      date < range.from ||
      date > range.to ||
      !Number.isInteger(period) ||
      period < 1 ||
      period > 20
    ) {
      throw new TimetableError(
        "NEIS_FORMAT",
        "요청한 학급과 일치하지 않는 시간표 응답입니다.",
      );
    }
    if (typeof row.ITRT_CNTNT !== "string")
      throw new TimetableError(
        "NEIS_FORMAT",
        "수업 내용 형식을 확인할 수 없습니다.",
      );
    if (!row.ITRT_CNTNT.trim()) continue;
    result.push({
      date,
      period,
      content: row.ITRT_CNTNT.trim(),
      department: row.DDDEP_NM ?? "",
      updatedAt: row.LOAD_DTM ?? null,
    });
  }
  return result;
}

export function createTimetableMiddleware({
  getApiKey = readApiKey,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
} = {}) {
  const cache = new Map(),
    pending = new Map();
  async function load(range, key, refresh) {
    const id = `${createHash("sha256").update(key).digest("hex")}:${range.grade}:${range.classroom}:${range.from}`;
    const cached = cache.get(id);
    if (!refresh && cached && now() - cached.time < TTL)
      return { ...cached.value, cached: true };
    if (pending.has(id)) return pending.get(id);
    const request = (async () => {
      const params = new URLSearchParams({
        KEY: key,
        Type: "json",
        pIndex: "1",
        pSize: "1000",
        ATPT_OFCDC_SC_CODE: SCHOOL.office,
        SD_SCHUL_CODE: SCHOOL.code,
        GRADE: range.grade,
        CLASS_NM: range.classroom,
        TI_FROM_YMD: range.from.replaceAll("-", ""),
        TI_TO_YMD: range.to.replaceAll("-", ""),
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetchImpl(
          `https://open.neis.go.kr/hub/hisTimetable?${params}`,
          { signal: controller.signal },
        );
        if (!response.ok)
          throw new TimetableError(
            "NEIS_UNAVAILABLE",
            "나이스 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.",
          );
        const rows = parseNeisResponse(await response.json(), range);
        const value = {
          source: "NEIS",
          school: SCHOOL.name,
          ...range,
          fetchedAt: new Date(now()).toISOString(),
          rows,
          teacherAvailable: false,
        };
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(id, { value, time: now() });
        return { ...value, cached: false };
      } finally {
        clearTimeout(timeout);
      }
    })();
    pending.set(id, request);
    try {
      return await request;
    } finally {
      pending.delete(id);
    }
  }
  return async function timetableMiddleware(req, res, next) {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/api/timetable") {
      if (next) return next();
      res.writeHead(404).end();
      return;
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    try {
      if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        throw new TimetableError(
          "METHOD_NOT_ALLOWED",
          "GET 요청만 지원합니다.",
          405,
        );
      }
      const range = queryRange(url.searchParams);
      const key = await getApiKey();
      if (
        !key ||
        key === "발급받은키" ||
        key === "YOUR_NEIS_API_KEY" ||
        key === "sample"
      )
        throw new TimetableError(
          "NEIS_KEY_MISSING",
          "나이스 인증키가 아직 등록되지 않았습니다. 학교 시간표 연결 설정이 필요합니다.",
          503,
        );
      const value = await load(
        range,
        key,
        url.searchParams.get("refresh") === "1",
      );
      if (!res.destroyed) res.writeHead(200).end(JSON.stringify(value));
    } catch (error) {
      const known = error instanceof TimetableError;
      if (!res.destroyed)
        res
          .writeHead(known ? error.status : 502)
          .end(
            JSON.stringify({
              error: {
                code: known ? error.code : "NEIS_UNAVAILABLE",
                message: known
                  ? error.message
                  : "시간표 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.",
              },
            }),
          );
    }
  };
}
