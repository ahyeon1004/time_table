import { BSSM, schoolKey, schoolType, validClass } from "../lib/schools.js";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  WarningCircle,
  CaretDown,
  Check,
} from "@phosphor-icons/react";
import { Brand, Button, Field, GoogleLogo } from "./ui.jsx";

export function Landing({ navigate }) {
  return (
    <main className="landing">
      <div className="landing-content">
        <h1>
          시간표<span>.</span>
        </h1>
        <div className="landing-actions">
          <Button className="google-button" onClick={() => navigate("/auth")}>
            <GoogleLogo />
            Google로 로그인
          </Button>
        </div>
      </div>
      <p className="landing-school">우리 학교 주간 시간표</p>
    </main>
  );
}
function AuthLayout({ children, navigate, back = "/", className = "" }) {
  return (
    <main className={`auth-page ${className}`}>
      <button
        className="auth-brand"
        onClick={() => navigate("/")}
        aria-label="첫 화면"
      >
        <Brand compact />
      </button>
      <section className="auth-content">
        <button className="back-link" onClick={() => navigate(back)}>
          <ArrowLeft size={17} />
          뒤로
        </button>
        {children}
      </section>
      <p className="auth-footer">시간표</p>
    </main>
  );
}
export function GoogleAuth({ navigate }) {
  const [ready, setReady] = useState(null);
  const [checking, setChecking] = useState(true);
  const error = new URLSearchParams(window.location.hash.split("?")[1]).get(
    "error",
  );
  const messages = {
    cancelled: "Google 로그인을 취소했습니다. 다시 시도할 수 있어요.",
    invalid: "인증 요청이 만료되었습니다. 다시 시작해 주세요.",
    failed: "Google 인증을 완료하지 못했습니다. 다시 시도해 주세요.",
  };
  function check() {
    setChecking(true);
    fetch("/api/auth/config", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setReady((await response.json()).ready);
      })
      .catch(() => setReady(false))
      .finally(() => setChecking(false));
  }
  useEffect(check, []);
  return (
    <AuthLayout navigate={navigate}>
      <header className="auth-heading">
        <span className="auth-icon">
          <ShieldCheck size={27} />
        </span>
        <h1>Google로 로그인</h1>
        <p>사용하는 Google 계정으로 계속해 주세요.</p>
      </header>
      {messages[error] && (
        <p className="account-error-message" role="alert">
          {messages[error]}
        </p>
      )}
      {!checking && !ready && (
        <div className="demo-notice" role="status">
          <p>
            Google 로그인 연결을 확인하는 중입니다.
            <br />
            설정이 완료되면 이용할 수 있어요.
          </p>
        </div>
      )}
      <Button
        disabled={checking || !ready}
        onClick={() => window.location.assign("/api/auth/google")}
      >
        <GoogleLogo />
        {checking ? "연결 확인 중" : "Google 계정 선택"}
      </Button>
      {!checking && !ready && (
        <button className="text-action" onClick={check}>
          다시 확인
        </button>
      )}
      <p className="school-help">
        이메일과 기본 프로필만 확인합니다.
        <br />
        비밀번호는 이 서비스에 저장하지 않습니다.
      </p>
    </AuthLayout>
  );
}
export function AccountError({ navigate }) {
  return (
    <AuthLayout navigate={navigate} back="/">
      <header className="auth-heading">
        <span className="auth-icon error-icon">
          <WarningCircle size={28} />
        </span>
        <h1>Google 계정을 확인해 주세요</h1>
        <p>Google에서 이메일을 확인한 뒤 다시 시도해 주세요.</p>
      </header>
      <div className="account-error-message">
        <strong>이메일 인증을 완료한 Google 계정을 선택해 주세요.</strong>
      </div>
      <Button onClick={() => navigate("/auth")}>
        Google 계정 다시 선택
        <ArrowRight size={17} />
      </Button>
      <Button variant="secondary" onClick={() => navigate("/login")}>
        로그인으로 돌아가기
      </Button>
    </AuthLayout>
  );
}
export function Profile({ navigate, onComplete, profile }) {
  const [school, setSchool] = useState(profile ? profile.school ?? BSSM : null);
  const [query, setQuery] = useState("");
  const [schools, setSchools] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState("");
  async function searchSchools() {
    const name = query.trim();
    if (name.length < 2 || searching) return;
    setSearching(true);
    setSchools([]);
    setSearchStatus("");
    try {
      const response = await fetch("/api/schools?" + new URLSearchParams({ q: name }));
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message);
      setSchools(body.schools);
      if (!body.schools.length) setSearchStatus("검색 결과가 없어요. 학교 이름을 확인해 주세요.");
    } catch (error) {
      setSearchStatus(error.message || "학교 검색에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setSearching(false);
    }
  }
  const [grade, setGrade] = useState(profile?.grade ?? "");
  const [classroom, setClassroom] = useState(profile?.classroom ?? "");
  const [number, setNumber] = useState(profile?.number ?? "");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  async function submit(event) {
    event.preventDefault();
    const next = {};
    if (!school) next.school = "학교를 검색해서 선택해 주세요.";
    if (!grade) next.grade = "학년을 선택해 주세요.";
    if (school && grade && !validClass(grade, classroom, school)) next.classroom = "1~99 사이의 반 번호를 입력해 주세요.";
    if (
      !/^\d{1,3}$/.test(String(number)) ||
      Number(number) < 1 ||
      !Number.isSafeInteger(Number(number))
    )
      next.number = "1 이상의 올바른 번호를 입력해 주세요.";
    setErrors(next);
    if (!Object.keys(next).length) {
      setSaving(true);
      setSaveError("");
      try {
        await onComplete({
          school: profile && !profile.school && school === BSSM ? undefined : school,
          grade, classroom, number: String(Number(number)),
        });
      } catch (error) {
        setSaveError(
          error.message || "저장하지 못했습니다. 다시 시도해 주세요.",
        );
      } finally {
        setSaving(false);
      }
    }
  }
  return (
    <AuthLayout navigate={navigate} back="/login">
      <header className="auth-heading">
        <span className="step-label">
          <Check size={13} weight="bold" />
          Google 계정 확인
        </span>
        <h1>학생 정보 등록</h1>
        <p>학교와 학년·반에 맞는 시간표를 보여드려요.</p>
      </header>
      <form className="profile-form" onSubmit={submit} noValidate>
        <Field id="school" label="학교" error={errors.school}>
          {school && <p><strong>{school.name}</strong> {school.region}</p>}
          <input id="school" type="search" aria-invalid={Boolean(errors.school)}
            aria-describedby={errors.school ? "school-error" : undefined} maxLength={60} value={query}
            placeholder="학교 이름으로 검색"
            onChange={(event) => {
              setQuery(event.target.value);
              setSchools([]);
              setSearchStatus("");
            }}
            disabled={searching || saving}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void searchSchools();
              }
            }}
          />
          <Button type="button" variant="secondary" disabled={query.trim().length < 2 || searching || saving} onClick={searchSchools}>
            {searching ? "검색 중" : "학교 검색"}
          </Button>
          {searchStatus && <p role="status">{searchStatus}</p>}
          {schools.length > 0 && <ul className="school-results" aria-label="학교 검색 결과">
            {schools.map((result) => (
              <li key={schoolKey(result)}>
                <button type="button" disabled={saving} onClick={() => {
                  setSchool(result);
                  if (!school || schoolKey(result) !== schoolKey(school)) {
                    setGrade("");
                    setClassroom("");
                    setNumber("");
                  }
                  setErrors({});
                  setSchools([]);
                  setQuery("");
                }}>
                  <strong>{result.name}</strong>
                  <span>{[result.region, result.address].filter(Boolean).join(" · ")}</span>
                </button>
              </li>
            ))}
          </ul>}
        </Field>
        <Field id="grade" label="학년" error={errors.grade}>
          <span className="select-wrap">
            <select
              id="grade"
              value={grade}
              aria-invalid={Boolean(errors.grade)}
              aria-describedby={errors.grade ? "grade-error" : undefined}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option value="">학년 선택</option>
              {Array.from({ length: schoolType(school?.kind)?.grades ?? 0 }, (_, index) => index + 1).map((g) => (
                <option key={g} value={g}>
                  {g}학년
                </option>
              ))}
            </select>
            <CaretDown size={15} />
          </span>
        </Field>
        <Field id="classroom" label="반" error={errors.classroom}>
          <input id="classroom" type="text" inputMode="numeric" maxLength={2}
            placeholder="반 번호 입력" value={classroom}
            aria-invalid={Boolean(errors.classroom)}
            aria-describedby={errors.classroom ? "classroom-error" : undefined}
            onChange={(event) => setClassroom(event.target.value)}
          />
        </Field>
        <Field id="number" label="번호" error={errors.number}>
          <input
            id="number"
            type="number"
            min="1"
            step="1"
            placeholder="번호 입력"
            inputMode="numeric"
            value={number}
            aria-invalid={Boolean(errors.number)}
            aria-describedby={errors.number ? "number-error" : undefined}
            onChange={(e) => setNumber(e.target.value)}
          />
        </Field>
        <p role="alert">{saveError}</p>
        <Button type="submit" className="profile-submit" disabled={saving}>
          {saving ? "저장 중" : "시작하기"}
          <ArrowRight size={17} />
        </Button>
      </form>
    </AuthLayout>
  );
}
