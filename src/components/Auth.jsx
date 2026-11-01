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
          <Button onClick={() => navigate("/login")}>
            로그인
            <ArrowRight size={18} />
          </Button>
          <Button variant="secondary" onClick={() => navigate("/signup")}>
            회원가입
          </Button>
        </div>
      </div>
      <p className="landing-school">부산소프트웨어마이스터고등학교</p>
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
      <p className="auth-footer">BSSM · 하루를 정리하는 가장 쉬운 방법</p>
    </main>
  );
}
export function Login({ signup = false, navigate }) {
  return (
    <AuthLayout navigate={navigate}>
      <header className="auth-heading">
        <h1>{signup ? "회원가입" : "로그인"}</h1>
        <p>
          {signup
            ? "학교 이메일을 사용해 가입해 주세요."
            : "학교 계정으로 로그인해 주세요."}
        </p>
      </header>
      <Button
        className="google-button"
        onClick={() => navigate(`/auth?mode=${signup ? "signup" : "login"}`)}
      >
        <GoogleLogo />
        Google로 {signup ? "회원가입" : "로그인"}
      </Button>
      {signup && (
        <p className="school-help">
          부산소프트웨어마이스터고등학교에서 사용하는
          <br />
          학교 Google 계정으로 가입해 주세요.
        </p>
      )}
      <p className="auth-switch">
        {signup ? "이미 계정이 있으신가요?" : "아직 계정이 없으신가요?"}
        <button onClick={() => navigate(signup ? "/login" : "/signup")}>
          {signup ? "로그인" : "회원가입"}
        </button>
      </p>
    </AuthLayout>
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
    <AuthLayout navigate={navigate} back="/login">
      <header className="auth-heading">
        <span className="auth-icon">
          <ShieldCheck size={27} />
        </span>
        <h1>학교 계정으로 시작하기</h1>
        <p>bssm.hs.kr Google 계정으로 계속해 주세요.</p>
      </header>
      {messages[error] && (
        <p className="account-error-message" role="alert">
          {messages[error]}
        </p>
      )}
      {!checking && !ready && (
        <div className="demo-notice" role="status">
          <p>
            학교 계정 로그인 준비 중입니다.
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
    <AuthLayout navigate={navigate} back="/signup">
      <header className="auth-heading">
        <span className="auth-icon error-icon">
          <WarningCircle size={28} />
        </span>
        <h1>학교 계정이 필요해요</h1>
        <p>선택한 계정으로는 가입할 수 없습니다.</p>
      </header>
      <div className="account-error-message">
        <strong>학교 Google 계정을 선택해 주세요.</strong>
        <p>
          학교에서 사용하는 계정인지 확인한 뒤<br />
          다시 시도해 주세요.
        </p>
      </div>
      <Button onClick={() => navigate("/auth")}>
        학교 계정으로 다시 선택
        <ArrowRight size={17} />
      </Button>
      <Button variant="secondary" onClick={() => navigate("/signup")}>
        회원가입으로 돌아가기
      </Button>
    </AuthLayout>
  );
}
export function Profile({ navigate, onComplete, profile }) {
  const [grade, setGrade] = useState(profile?.grade ?? "");
  const [classroom, setClassroom] = useState(profile?.classroom ?? "");
  const [number, setNumber] = useState(profile?.number ?? "");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  async function submit(event) {
    event.preventDefault();
    const next = {};
    if (!grade) next.grade = "학년을 선택해 주세요.";
    if (!classroom) next.classroom = "반을 선택해 주세요.";
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
        await onComplete({ grade, classroom, number: String(Number(number)) });
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
          학교 계정 확인
        </span>
        <h1>학생 정보 등록</h1>
        <p>학년·반에 맞는 시간표를 보여드려요.</p>
      </header>
      <form className="profile-form" onSubmit={submit} noValidate>
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
              {[1, 2, 3].map((g) => (
                <option key={g} value={g}>
                  {g}학년
                </option>
              ))}
            </select>
            <CaretDown size={15} />
          </span>
        </Field>
        <Field id="classroom" label="반" error={errors.classroom}>
          <span className="select-wrap">
            <select
              id="classroom"
              value={classroom}
              aria-invalid={Boolean(errors.classroom)}
              aria-describedby={
                errors.classroom ? "classroom-error" : undefined
              }
              onChange={(e) => setClassroom(e.target.value)}
            >
              <option value="">반 선택</option>
              {[1, 2, 3, 4].map((c) => (
                <option key={c} value={c}>
                  {c}반
                </option>
              ))}
            </select>
            <CaretDown size={15} />
          </span>
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
