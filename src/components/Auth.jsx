import { useEffect, useRef, useState } from "react";
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
export function GoogleAuth({ navigate, profile }) {
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // The demo continues synchronously: there is no network request or real account selection.
  const finish = () => {
    setLoading(true);
    timer.current = window.setTimeout(
      () => navigate(profile ? "/dashboard" : "/profile"),
      450,
    );
  };
  return (
    <AuthLayout navigate={navigate} back="/login">
      <header className="auth-heading">
        <span className="auth-icon">
          <ShieldCheck size={27} />
        </span>
        <h1>Google 인증 안내</h1>
        <p>학교 Google 계정으로 계속해 주세요.</p>
      </header>
      <div className="demo-notice">
        <span className="tiny-label">UI 시연 모드</span>
        <p>
          현재는 실제 Google 인증을 진행하지 않습니다.
          <br />
          계속하기를 누르면 {profile ? "시간표로" : "학생 정보 등록으로"}{" "}
          이동해요.
        </p>
      </div>
      <Button onClick={finish} disabled={loading}>
        {loading ? (
          <span className="button-loading">
            <span />
            계속하는 중
          </span>
        ) : (
          <>
            학교 계정으로 계속하기
            <ArrowRight size={17} />
          </>
        )}
      </Button>
      <button
        className="text-action auth-error-action"
        onClick={() => navigate("/account-error")}
      >
        학교 계정이 아닌 경우 보기
      </button>
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
  function submit(event) {
    event.preventDefault();
    const next = {};
    if (!grade) next.grade = "학년을 선택해 주세요.";
    if (!classroom) next.classroom = "반을 선택해 주세요.";
    if (
      !/^\d+$/.test(String(number)) ||
      Number(number) < 1 ||
      !Number.isSafeInteger(Number(number))
    )
      next.number = "1 이상의 올바른 번호를 입력해 주세요.";
    setErrors(next);
    if (!Object.keys(next).length)
      onComplete({ grade, classroom, number: String(Number(number)) });
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
        <Button type="submit" className="profile-submit">
          시작하기
          <ArrowRight size={17} />
        </Button>
      </form>
    </AuthLayout>
  );
}
