import { createHash } from "node:crypto";
const hash = (value) => createHash("sha256").update(value).digest("hex");
export function edgeStore(db) {
  const first = (sql, ...args) =>
    db
      .prepare(sql)
      .bind(...args)
      .first();
  const run = (sql, ...args) =>
    db
      .prepare(sql)
      .bind(...args)
      .run();
  const userRow = (row) =>
    row
      ? {
          id: row.id,
          email: row.email,
          name: row.name,
          profile: row.profile ? JSON.parse(row.profile) : null,
        }
      : null;
  return {
    async begin(token, value) {
      await db.batch([
        db.prepare("DELETE FROM attempts WHERE expires<=?").bind(Date.now()),
        db
          .prepare("INSERT INTO attempts VALUES (?, ?, ?, ?, ?)")
          .bind(
            hash(token),
            hash(value.state),
            value.nonce,
            value.verifier,
            value.expires,
          ),
      ]);
    },
    async consume(token, state) {
      const row = await first(
        "DELETE FROM attempts WHERE token=? RETURNING *",
        hash(token),
      );
      return row && row.expires > Date.now() && row.state === hash(state)
        ? row
        : null;
    },
    async login(claims, token, expires, previous) {
      const queries = [
        db
          .prepare(
            "INSERT INTO users (id,email,name) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name",
          )
          .bind(claims.sub, claims.email, claims.name || "학생"),
        db.prepare("DELETE FROM sessions WHERE expires<=?").bind(Date.now()),
      ];
      if (previous)
        queries.push(
          db.prepare("DELETE FROM sessions WHERE token=?").bind(hash(previous)),
        );
      queries.push(
        db
          .prepare("INSERT INTO sessions VALUES (?, ?, ?)")
          .bind(hash(token), claims.sub, expires),
      );
      await db.batch(queries);
    },
    async user(token) {
      return token
        ? userRow(
            await first(
              "SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>?",
              hash(token),
              Date.now(),
            ),
          )
        : null;
    },
    async profile(id, value) {
      await run(
        "UPDATE users SET profile=? WHERE id=?",
        JSON.stringify(value),
        id,
      );
    },
    async logout(token) {
      if (token)
        await db.batch([
          db
            .prepare("DELETE FROM push_devices WHERE session_token=?")
            .bind(hash(token)),
          db.prepare("DELETE FROM sessions WHERE token=?").bind(hash(token)),
        ]);
    },
    async savePush(user, token, subscription, settings) {
      const existing = await first(
        "SELECT user_id FROM push_devices WHERE endpoint=?",
        subscription.endpoint,
      );
      if (existing && existing.user_id !== user.id)
        throw new Error("ownership");
      if (
        !existing &&
        (
          await first(
            "SELECT count(*) AS n FROM push_devices WHERE user_id=?",
            user.id,
          )
        ).n >= 10
      )
        throw new Error("limit");
      await run(
        "INSERT INTO push_devices VALUES (?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET session_token=excluded.session_token,subscription=excluded.subscription,settings=excluded.settings WHERE push_devices.user_id=excluded.user_id",
        subscription.endpoint,
        user.id,
        hash(token),
        JSON.stringify(subscription),
        JSON.stringify(settings),
      );
    },
    async pushDevice(userId, endpoint) {
      const row = await first(
        "SELECT push_devices.* FROM push_devices JOIN sessions ON sessions.token=push_devices.session_token WHERE push_devices.user_id=? AND endpoint=? AND sessions.expires>?",
        userId,
        endpoint,
        Date.now(),
      );
      return row
        ? {
            ...row,
            subscription: JSON.parse(row.subscription),
            settings: JSON.parse(row.settings),
          }
        : null;
    },
    async updatePush(userId, endpoint, settings) {
      await run(
        "UPDATE push_devices SET settings=? WHERE user_id=? AND endpoint=?",
        JSON.stringify(settings),
        userId,
        endpoint,
      );
    },
    async removePush(userId, endpoint) {
      await run(
        "DELETE FROM push_devices WHERE user_id=? AND endpoint=?",
        userId,
        endpoint,
      );
    },
    async pushDevices() {
      await run(
        "DELETE FROM push_devices WHERE session_token NOT IN (SELECT token FROM sessions WHERE expires>?)",
        Date.now(),
      );
      const { results } = await db
        .prepare(
          "SELECT push_devices.*,users.profile FROM push_devices JOIN users ON users.id=push_devices.user_id WHERE users.profile IS NOT NULL",
        )
        .all();
      return results.map((row) => ({
        ...row,
        profile: JSON.parse(row.profile),
        subscription: JSON.parse(row.subscription),
        settings: JSON.parse(row.settings),
      }));
    },
    async claimPush(endpoint, lesson, now) {
      const row = await first(
        "INSERT INTO push_deliveries VALUES (?, ?, 'sending', ?) ON CONFLICT(device,lesson) DO UPDATE SET status='sending',time=excluded.time WHERE push_deliveries.status!='sent' AND push_deliveries.time<? RETURNING device",
        hash(endpoint),
        lesson,
        now,
        now - 120_000,
      );
      return !!row;
    },
    async finishPush(endpoint, lesson, now, success) {
      if (success)
        await run(
          "UPDATE push_deliveries SET status='sent',time=? WHERE device=? AND lesson=?",
          now,
          hash(endpoint),
          lesson,
        );
      else
        await run(
          "DELETE FROM push_deliveries WHERE device=? AND lesson=?",
          hash(endpoint),
          lesson,
        );
    },
    async cleanup() {
      await db.batch([
        db.prepare("DELETE FROM attempts WHERE expires<=?").bind(Date.now()),
        db
          .prepare("DELETE FROM push_deliveries WHERE time<?")
          .bind(Date.now() - 7 * 86400_000),
      ]);
    },
  };
}
