import { pushStore } from "./push-store.js";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";

export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export function createAuthStore(path) {
  if (path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL, profile TEXT);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts (token TEXT PRIMARY KEY, state TEXT NOT NULL, nonce TEXT NOT NULL, verifier TEXT NOT NULL, expires INTEGER NOT NULL);`);
  const pushes = pushStore(db);
  return {
    ...pushes,
    begin(token, value) {
      db.prepare("DELETE FROM attempts WHERE expires <= ?").run(Date.now());
      db.prepare("INSERT INTO attempts VALUES (?, ?, ?, ?, ?)").run(
        digest(token),
        digest(value.state),
        value.nonce,
        value.verifier,
        value.expires,
      );
    },
    consume(token, state) {
      const entry = db
        .prepare("DELETE FROM attempts WHERE token = ? RETURNING *")
        .get(digest(token));
      return entry &&
        entry.expires > Date.now() &&
        entry.state === digest(state)
        ? entry
        : null;
    },
    login(claims, token, expires, previousToken) {
      db.prepare(
        "INSERT INTO users (id, email, name) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET email=excluded.email, name=excluded.name",
      ).run(claims.sub, claims.email, claims.name || "학생");
      if (previousToken)
        db.prepare("DELETE FROM sessions WHERE token = ?").run(
          digest(previousToken),
        );
      db.prepare("DELETE FROM sessions WHERE expires <= ?").run(Date.now());
      db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(
        digest(token),
        claims.sub,
        expires,
      );
    },
    user(token) {
      if (!token) return null;
      const row = db
        .prepare(
          "SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>?",
        )
        .get(digest(token), Date.now());
      return row
        ? {
            id: row.id,
            email: row.email,
            name: row.name,
            profile: row.profile ? JSON.parse(row.profile) : null,
          }
        : null;
    },
    renew(token, expires) {
      if (!token) return false;
      return db.prepare("UPDATE sessions SET expires=? WHERE token=? AND expires>?")
        .run(expires, digest(token), Date.now()).changes > 0;
    },
    profile(id, value) {
      db.prepare("UPDATE users SET profile=? WHERE id=?").run(
        JSON.stringify(value),
        id,
      );
    },
    logout(token) {
      pushes.removeSessionPush(token);
      if (token)
        db.prepare("DELETE FROM sessions WHERE token=?").run(digest(token));
    },
    close() {
      db.close();
    },
  };
}
