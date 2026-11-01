import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { createAuthStore } from "./auth-store.js";

export async function readAuthConfig(root = process.cwd()) {
  let file = {};
  try {
    const content = await readFile(resolve(root, ".env.local"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(
        /^\s*([A-Z_]+)\s*=\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^#\r\n]*))/,
      );
      if (match) file[match[1]] = (match[2] ?? match[3] ?? match[4]).trim();
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const value = (key) => process.env[key]?.trim() || file[key] || "";
  const origin = value("APP_ORIGIN");
  const domains = value("GOOGLE_ALLOWED_DOMAINS")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  let validOrigin = false;
  try {
    const url = new URL(origin);
    validOrigin =
      url.origin === origin &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)));
  } catch {}
  return {
    clientId: value("GOOGLE_CLIENT_ID"),
    clientSecret: value("GOOGLE_CLIENT_SECRET"),
    origin,
    domains,
    ready: Boolean(
      value("GOOGLE_CLIENT_ID") &&
      value("GOOGLE_CLIENT_SECRET") &&
      validOrigin &&
      domains.length,
    ),
  };
}
export function validateSchoolClaims(claims, nonce, domains) {
  if (
    !claims?.sub ||
    typeof claims.email !== "string" ||
    claims.email_verified !== true ||
    claims.nonce !== nonce
  )
    return false;
  const domain = claims.email.split("@");
  return (
    domain.length === 2 &&
    domains.includes(domain[1].toLowerCase()) &&
    typeof claims.hd === "string" &&
    domains.includes(claims.hd.toLowerCase())
  );
}
export const validStudentProfile = (value) =>
  value &&
  ["1", "2", "3"].includes(value.grade) &&
  ["1", "2", "3", "4"].includes(value.classroom) &&
  /^\d{1,3}$/.test(value.number) &&
  Number(value.number) > 0;
const random = () => randomBytes(32).toString("base64url");
const cookies = (req) =>
  Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim().split("="))
      .filter((x) => x.length === 2),
  );
const cookie = (name, value, maxAge, secure) =>
  `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
const json = (res, status, body) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(body));
};
async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 4096) throw new Error("body size");
  }
  return JSON.parse(body);
}
export function createAuthMiddleware({
  root = process.cwd(),
  getConfig = () => readAuthConfig(root),
  clientFactory = (config) =>
    new OAuth2Client(
      config.clientId,
      config.clientSecret,
      `${config.origin}/api/auth/callback`,
    ),
  storeFactory = () => createAuthStore(resolve(root, ".data/auth.sqlite")),
} = {}) {
  let database;
  const store = () => (database ??= storeFactory());
  return async (req, res, next) => {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/api/auth/")) return next?.();
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    try {
      const config = await getConfig();
      const secure = config.origin.startsWith("https:");
      const fail = (status, message) =>
        json(res, status, { error: { message } });
      const redirect = (path) => {
        res.writeHead(302, { Location: path });
        res.end();
      };
      const method = req.method;
      if (url.pathname === "/api/auth/config" && method === "GET")
        return json(res, 200, { ready: config.ready });
      if (url.pathname === "/api/auth/session" && method === "GET")
        return json(res, 200, {
          user: config.ready ? store().user(cookies(req).bssm_session) : null,
        });
      if (!config.ready)
        return fail(503, "Google 로그인 설정이 아직 완료되지 않았습니다.");
      const jar = cookies(req);
      if (url.pathname === "/api/auth/google" && method === "GET") {
        const token = random(),
          state = random(),
          nonce = random();
        const client = clientFactory(config);
        const { codeVerifier, codeChallenge } =
          await client.generateCodeVerifierAsync();
        store().begin(token, {
          state,
          nonce,
          verifier: codeVerifier,
          expires: Date.now() + 600_000,
        });
        res.setHeader("Set-Cookie", cookie("bssm_oauth", token, 600, secure));
        return redirect(
          client.generateAuthUrl({
            scope: ["openid", "email", "profile"],
            state,
            nonce,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            prompt: "select_account",
            ...(config.domains.length === 1 ? { hd: config.domains[0] } : {}),
          }),
        );
      }
      if (url.pathname === "/api/auth/callback" && method === "GET") {
        res.setHeader("Set-Cookie", cookie("bssm_oauth", "", 0, secure));
        const attempt =
          jar.bssm_oauth &&
          store().consume(jar.bssm_oauth, url.searchParams.get("state") || "");
        if (!attempt) return redirect("/#/auth?error=invalid");
        if (url.searchParams.has("error"))
          return redirect("/#/auth?error=cancelled");
        const code = url.searchParams.get("code");
        if (!code) return redirect("/#/auth?error=invalid");
        try {
          const client = clientFactory(config);
          const { tokens } = await client.getToken({
            code,
            codeVerifier: attempt.verifier,
          });
          const ticket = await client.verifyIdToken({
            idToken: tokens.id_token,
            audience: config.clientId,
          });
          const claims = ticket.getPayload();
          if (!validateSchoolClaims(claims, attempt.nonce, config.domains))
            return redirect("/#/account-error");
          const token = random();
          store().login(
            claims,
            token,
            Date.now() + 7 * 86400_000,
            jar.bssm_session,
          );
          res.setHeader("Set-Cookie", [
            cookie("bssm_oauth", "", 0, secure),
            cookie("bssm_session", token, 7 * 86400, secure),
          ]);
          return redirect(
            store().user(token).profile ? "/#/dashboard" : "/#/profile",
          );
        } catch {
          return redirect("/#/auth?error=failed");
        }
      }
      if (
        ["/api/auth/profile", "/api/auth/logout"].includes(url.pathname) &&
        method === "POST"
      ) {
        if (
          req.headers.origin !== config.origin ||
          !req.headers["content-type"]?.startsWith("application/json")
        )
          return fail(403, "올바른 화면에서 다시 시도해 주세요.");
        const user = store().user(jar.bssm_session);
        if (!user) return fail(401, "다시 로그인해 주세요.");
        if (url.pathname.endsWith("/logout")) {
          store().logout(jar.bssm_session);
          res.setHeader("Set-Cookie", cookie("bssm_session", "", 0, secure));
          return json(res, 200, { ok: true });
        }
        let profile;
        try {
          profile = await readBody(req);
        } catch {
          return fail(400, "학생 정보를 확인해 주세요.");
        }
        if (!validStudentProfile(profile))
          return fail(400, "학년·반·번호를 확인해 주세요.");
        store().profile(user.id, {
          grade: profile.grade,
          classroom: profile.classroom,
          number: String(Number(profile.number)),
        });
        return json(res, 200, { user: store().user(jar.bssm_session) });
      }
      return fail(405, "지원하지 않는 요청입니다.");
    } catch {
      return json(res, 500, {
        error: {
          message: "로그인을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        },
      });
    }
  };
}
