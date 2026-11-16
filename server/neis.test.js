import { normalizeTimetable } from "../src/lib/timetable.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  createTimetableMiddleware,
  parseNeisResponse,
  findSchools,
  queryRange,
  SCHOOL,
} from "./neis.js";

const url = "/api/timetable?grade=1&classroom=1&week=2026-10-26";
const range = {
  grade: "1",
  classroom: "1",
  from: "2026-10-26",
  to: "2026-10-30",
};
const row = {
  ATPT_OFCDC_SC_CODE: SCHOOL.office,
  SD_SCHUL_CODE: SCHOOL.code,
  GRADE: "1",
  CLASS_NM: "1",
  ALL_TI_YMD: "20261026",
  PERIO: "1",
  ITRT_CNTNT: "체육2",
  LOAD_DTM: "20261101",
};
const payload = (rows = [row], total = rows.length) => ({
  hisTimetable: [
    { head: [{ list_total_count: total }, { RESULT: { CODE: "INFO-000" } }] },
    { row: rows },
  ],
});
async function invoke(middleware, path = url, method = "GET") {
  const res = {
    headers: {},
    status: 200,
    destroyed: false,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    writeHead(status) {
      this.status = status;
      return this;
    },
    end(body) {
      this.body = body ? JSON.parse(body) : null;
      return this;
    },
  };
  await middleware({ url: path, method }, res);
  return res;
}
test("키가 없으면 외부 요청 없이 연결 안내를 반환한다", async () => {
  let requested = false;
  const res = await invoke(
    createTimetableMiddleware({
      getApiKey: async () => "",
      fetchImpl: async () => {
        requested = true;
      },
    }),
  );
  assert.equal(res.status, 503);
  assert.equal(res.body.error.code, "NEIS_KEY_MISSING");
  assert.equal(requested, false);
});
test("학교·학년·반·주간으로 요청하고 인증키를 응답에 노출하지 않는다", async () => {
  let requested;
  const middleware = createTimetableMiddleware({
    getApiKey: async () => "test-private-key",
    fetchImpl: async (path) => {
      requested = new URL(path);
      return { ok: true, json: async () => payload() };
    },
  });
  const res = await invoke(middleware);
  assert.equal(res.status, 200);
  assert.equal(res.body.rows[0].content, "체육2");
  assert.equal(requested.searchParams.get("KEY"), "test-private-key");
  assert.equal(requested.searchParams.get("TI_FROM_YMD"), "20261026");
  assert.equal(requested.searchParams.get("TI_TO_YMD"), "20261030");
  assert.equal(requested.searchParams.get("GRADE"), "1");
  assert.equal(requested.searchParams.get("CLASS_NM"), "1");
  assert.equal(JSON.stringify(res.body).includes("test-private-key"), false);
});
test("동일 조회는 캐시하고 새로고침·다른 학급은 별도 조회한다", async () => {
  let calls = 0;
  const middleware = createTimetableMiddleware({
    getApiKey: async () => "test-key",
    fetchImpl: async (path) => {
      calls++;
      const classroom = new URL(path).searchParams.get("CLASS_NM");
      return {
        ok: true,
        json: async () => payload([{ ...row, CLASS_NM: classroom }]),
      };
    },
  });
  await invoke(middleware);
  const cached = await invoke(middleware);
  assert.equal(cached.body.cached, true);
  assert.equal(calls, 1);
  await invoke(middleware, url + "&refresh=1");
  await invoke(middleware, url.replace("classroom=1", "classroom=2"));
  assert.equal(calls, 3);
});
test("INFO-200은 수업 없는 주간으로 처리하고 샘플 5건을 전체 시간표로 받지 않는다", () => {
  assert.deepEqual(
    parseNeisResponse({ RESULT: { CODE: "INFO-200" } }, range),
    [],
  );
  assert.throws(
    () =>
      parseNeisResponse(
        payload(
          Array.from({ length: 5 }, () => row),
          33,
        ),
        range,
      ),
    { code: "NEIS_INCOMPLETE" },
  );
});
test("통신 오류에 포함된 URL이나 키를 클라이언트에 노출하지 않는다", async () => {
  const res = await invoke(
    createTimetableMiddleware({
      getApiKey: async () => "test-private-key",
      fetchImpl: async () => {
        throw new Error("failed https://example.com/?KEY=test-private-key");
      },
    }),
  );
  assert.equal(res.status, 502);
  assert.equal(JSON.stringify(res.body).includes("test-private-key"), false);
});
test("잘못된 반·날짜·요청 방식은 거부한다", async () => {
  assert.throws(
    () =>
      queryRange(
        new URLSearchParams({ grade: "1", classroom: "1", week: "2026-02-30" }),
      ),
    { code: "INVALID_QUERY" },
  );
  assert.throws(
    () =>
      queryRange(
        new URLSearchParams({ grade: "1", classroom: "1", week: "2026-10-27" }),
      ),
    { code: "INVALID_QUERY" },
  );
  const middleware = createTimetableMiddleware();
  assert.equal((await invoke(middleware, url, "POST")).status, 405);
  assert.equal(
    (await invoke(middleware, url.replace("grade=1", "grade=0"))).status,
    400,
  );
});


test("다른 학교는 학교 유형별 시간표를 요청하고 교사 보정을 적용하지 않는다", async () => {
  const school = { office: "J10", code: "7699999", kind: "초등학교" };
  const params = new URLSearchParams({ ...school, grade: "6", classroom: "12", week: "2026-11-16" });
  const range = queryRange(params);
  assert.deepEqual(range.school, school);
  const subjects = [{
    ATPT_OFCDC_SC_CODE: school.office, SD_SCHUL_CODE: school.code,
    GRADE: "6", CLASS_NM: "12", ALL_TI_YMD: "20261116", PERIO: "1", ITRT_CNTNT: "수학",
  }];
  const value = await createTimetableMiddleware({
    getApiKey: async () => "test",
    fetchImpl: async (url) => {
      const request = new URL(url);
      assert.equal(request.pathname, "/hub/elsTimetable");
      assert.equal(request.searchParams.get("SD_SCHUL_CODE"), school.code);
      return Response.json({ elsTimetable: [
        { head: [{ list_total_count: 1 }, { RESULT: { CODE: "INFO-000" } }] },
        { row: subjects },
      ] });
    },
  }).load(range);
  assert.equal(value.rows[0].content, "수학");
  assert.deepEqual(value.schoolIdentity, school);
  const normalized = normalizeTimetable(value, { ...range, week: new Date(2026, 10, 16) });
  assert.equal(normalized.byDate["2026-11-16"][0].teacher, null);
  assert.throws(() => queryRange(new URLSearchParams({ ...Object.fromEntries(params), kind: "기타" })));
});

test("학교 검색은 나이스의 학교 코드와 학교 종류를 반환한다", async () => {
  const schools = await findSchools("예시", "test", async (url) => {
    const request = new URL(url);
    assert.equal(request.pathname, "/hub/schoolInfo");
    assert.equal(request.searchParams.get("SCHUL_NM"), "예시");
    return Response.json({ schoolInfo: [null, { row: [
      { ATPT_OFCDC_SC_CODE: "J10", SD_SCHUL_CODE: "7699999", SCHUL_KND_SC_NM: "초등학교", SCHUL_NM: "예시초등학교" },
      { ATPT_OFCDC_SC_CODE: "J10", SD_SCHUL_CODE: "7699998", SCHUL_KND_SC_NM: "대학교", SCHUL_NM: "예시대학교" },
    ] }] });
  });
  assert.deepEqual(schools.map(({ code, kind, name }) => [code, kind, name]), [["7699999", "초등학교", "예시초등학교"]]);
});
