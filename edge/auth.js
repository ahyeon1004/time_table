import { SESSION_MAX_AGE, sessionExpires } from "../server/session.js";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { randomBytes, createHash } from "node:crypto";
const jwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const random = () => randomBytes(32).toString("base64url");
const cookie = (name, value, maxAge, secure) =>
  `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
export function authConfig(env) {
  const domains = (env.GOOGLE_ALLOWED_DOMAINS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  let valid = false;
  try {
    const url = new URL(env.APP_ORIGIN);
    valid =
      url.origin === env.APP_ORIGIN &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["127.0.0.1", "localhost"].includes(url.hostname)));
  } catch {}
  return {
    ready: !!(
      valid &&
      env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      domains.length &&
      env.DB
    ),
    origin: env.APP_ORIGIN,
    domains,
    secure: env.APP_ORIGIN?.startsWith("https:"),
  };
}
export const json = (status, value) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const redirect = (location, cookies = []) => {
  const headers = new Headers({
    Location: location,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 302, headers });
};
export const jar = (request) =>
  Object.fromEntries(
    (request.headers.get("cookie") || "")
      .split(";")
      .map((x) => x.trim().split("="))
      .filter((x) => x.length === 2),
  );
export function validProfile(value) {
  return (
    value &&
    ["1", "2", "3"].includes(value.grade) &&
    ["1", "2", "3", "4"].includes(value.classroom) &&
    /^\d{1,3}$/.test(value.number) &&
    Number(value.number) > 0
  );
}
export async function bodyJSON(request, limit = 4096) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty");
  let bytes = 0,
    text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw new Error("size");
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally {
    await reader.cancel();
  }
}
export async function handleAuth(
  request,
  env,
  store,
  { exchange, verify } = {},
) {
  const url = new URL(request.url),
    config = authConfig(env),
    cookies = jar(request),
    method = request.method;
  if (url.pathname === "/api/auth/config" && method === "GET")
    return json(200, { ready: config.ready });
  if (url.pathname === "/api/auth/session" && method === "GET") {
    const token = cookies.bssm_session;
    const renewed = config.ready && await store.renew(token, sessionExpires());
    const user = renewed ? await store.user(token) : null;
    const response = json(200, { user });
    if (user) response.headers.append("Set-Cookie", cookie("bssm_session", token, SESSION_MAX_AGE, config.secure));
    return response;
  }
  if (!config.ready)
    return json(503, {
      error: { message: "Google 로그인 설정을 준비 중입니다." },
    });
  if (url.pathname === "/api/auth/google" && method === "GET") {
    const token = random(),
      state = random(),
      nonce = random(),
      verifier = random();
    await store.begin(token, {
      state,
      nonce,
      verifier,
      expires: Date.now() + 600_000,
    });
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: `${config.origin}/api/auth/callback`,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    if (config.domains.length === 1) params.set("hd", config.domains[0]);
    return redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params, [
      cookie("bssm_oauth", token, 600, config.secure),
    ]);
  }
  if (url.pathname === "/api/auth/callback" && method === "GET") {
    const cleared = [cookie("bssm_oauth", "", 0, config.secure)];
    const attempt =
      cookies.bssm_oauth &&
      (await store.consume(
        cookies.bssm_oauth,
        url.searchParams.get("state") || "",
      ));
    if (!attempt) return redirect("/#/auth?error=invalid", cleared);
    if (url.searchParams.has("error"))
      return redirect("/#/auth?error=cancelled", cleared);
    const code = url.searchParams.get("code");
    if (!code) return redirect("/#/auth?error=invalid", cleared);
    try {
      let tokens;
      if (exchange) tokens = await exchange(code, attempt.verifier);
      else {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          body: new URLSearchParams({
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: `${config.origin}/api/auth/callback`,
            grant_type: "authorization_code",
            code,
            code_verifier: attempt.verifier,
          }),
          signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) throw new Error("exchange");
        tokens = await response.json();
      }
      const claims = verify
        ? await verify(tokens.id_token)
        : (
            await jwtVerify(tokens.id_token, jwks, {
              audience: env.GOOGLE_CLIENT_ID,
              issuer: ["https://accounts.google.com", "accounts.google.com"],
              algorithms: ["RS256"],
            })
          ).payload;
      const domain =
        typeof claims.email === "string" ? claims.email.split("@") : [];
      if (
        !claims.sub ||
        claims.email_verified !== true ||
        claims.nonce !== attempt.nonce ||
        domain.length !== 2 ||
        !config.domains.includes(domain[1].toLowerCase()) ||
        typeof claims.hd !== "string" ||
        !config.domains.includes(claims.hd.toLowerCase())
      )
        return redirect("/#/account-error", cleared);
      const token = random();
      await store.login(
        claims,
        token,
        sessionExpires(),
        cookies.bssm_session,
      );
      const user = await store.user(token);
      return redirect(user.profile ? "/#/dashboard" : "/#/profile", [
        ...cleared,
        cookie("bssm_session", token, SESSION_MAX_AGE, config.secure),
      ]);
    } catch {
      return redirect("/#/auth?error=failed", cleared);
    }
  }
  if (
    ["/api/auth/profile", "/api/auth/logout"].includes(url.pathname) &&
    method === "POST"
  ) {
    if (
      request.headers.get("origin") !== config.origin ||
      !request.headers.get("content-type")?.startsWith("application/json")
    )
      return json(403, {
        error: { message: "올바른 화면에서 다시 시도해 주세요." },
      });
    const user = await store.user(cookies.bssm_session);
    if (!user)
      return json(401, { error: { message: "다시 로그인해 주세요." } });
    if (url.pathname.endsWith("/logout")) {
      await store.logout(cookies.bssm_session);
      const response = json(200, { ok: true });
      response.headers.append(
        "Set-Cookie",
        cookie("bssm_session", "", 0, config.secure),
      );
      return response;
    }
    let profile;
    try {
      profile = await bodyJSON(request);
    } catch {
      return json(400, { error: { message: "학생 정보를 확인해 주세요." } });
    }
    if (!validProfile(profile))
      return json(400, { error: { message: "학년·반·번호를 확인해 주세요." } });
    await store.profile(user.id, {
      grade: profile.grade,
      classroom: profile.classroom,
      number: String(Number(profile.number)),
    });
    return json(200, { user: await store.user(cookies.bssm_session) });
  }
  return json(405, { error: { message: "지원하지 않는 요청입니다." } });
}
