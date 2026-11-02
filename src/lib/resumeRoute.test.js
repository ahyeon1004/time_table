import test from "node:test";
import assert from "node:assert/strict";
import { resumeRoute } from "./resumeRoute.js";
test("설치 앱의 첫 주소는 기존 로그인으로 시간표에 바로 진입한다", () => {
  const user = {id:"student", profile:{grade:"1",classroom:"1",number:"4"}};
  for (const route of ["/", "/login", "/signup", "/auth"])
    assert.equal(resumeRoute(route,user), "/dashboard");
  assert.equal(resumeRoute("/",{...user,profile:null}), "/profile");
  assert.equal(resumeRoute("/",null), "/");
  assert.equal(resumeRoute("/notifications",user), "/notifications");
  assert.equal(resumeRoute("/profile",user), "/profile");
  assert.equal(resumeRoute("/account-error",user), "/account-error");
});
