import { createHash } from "node:crypto";
const digest = (value) => createHash("sha256").update(value).digest("hex");
export function pushStore(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS push_devices (endpoint TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), session_token TEXT NOT NULL, subscription TEXT NOT NULL, settings TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS push_deliveries (device TEXT NOT NULL, lesson TEXT NOT NULL, status TEXT NOT NULL, time INTEGER NOT NULL, PRIMARY KEY(device, lesson));`);
  return {
    savePush(user, token, subscription, settings) {
      const existing = db
        .prepare("SELECT user_id FROM push_devices WHERE endpoint=?")
        .get(subscription.endpoint);
      if (existing && existing.user_id !== user.id)
        throw new Error("device ownership");
      if (
        !existing &&
        db
          .prepare("SELECT count(*) AS n FROM push_devices WHERE user_id=?")
          .get(user.id).n >= 10
      )
        throw new Error("device limit");
      db.prepare(
        "INSERT INTO push_devices VALUES (?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET session_token=excluded.session_token, subscription=excluded.subscription, settings=excluded.settings",
      ).run(
        subscription.endpoint,
        user.id,
        digest(token),
        JSON.stringify(subscription),
        JSON.stringify(settings),
      );
    },
    pushDevice(userId, endpoint) {
      const row = db
        .prepare(
          "SELECT push_devices.* FROM push_devices JOIN sessions ON sessions.token=push_devices.session_token WHERE push_devices.user_id=? AND endpoint=? AND sessions.expires>?",
        )
        .get(userId, endpoint, Date.now());
      return row
        ? {
            ...row,
            subscription: JSON.parse(row.subscription),
            settings: JSON.parse(row.settings),
          }
        : null;
    },
    updatePush(userId, endpoint, settings) {
      db.prepare(
        "UPDATE push_devices SET settings=? WHERE user_id=? AND endpoint=?",
      ).run(JSON.stringify(settings), userId, endpoint);
    },
    removePush(userId, endpoint) {
      db.prepare("DELETE FROM push_devices WHERE user_id=? AND endpoint=?").run(
        userId,
        endpoint,
      );
    },
    removeSessionPush(token) {
      if (token)
        db.prepare("DELETE FROM push_devices WHERE session_token=?").run(
          digest(token),
        );
    },
    pushDevices() {
      db.prepare(
        "DELETE FROM push_devices WHERE session_token NOT IN (SELECT token FROM sessions WHERE expires>?)",
      ).run(Date.now());
      return db
        .prepare(
          "SELECT push_devices.*, users.profile FROM push_devices JOIN users ON users.id=push_devices.user_id WHERE users.profile IS NOT NULL",
        )
        .all()
        .map((row) => ({
          ...row,
          profile: JSON.parse(row.profile),
          subscription: JSON.parse(row.subscription),
          settings: JSON.parse(row.settings),
        }));
    },
    claimPush(endpoint, lesson, now) {
      db.prepare("DELETE FROM push_deliveries WHERE time<?").run(
        now - 7 * 86400_000,
      );
      const device = digest(endpoint);
      const old = db
        .prepare("SELECT * FROM push_deliveries WHERE device=? AND lesson=?")
        .get(device, lesson);
      if (old && (old.status === "sent" || now - old.time < 120_000))
        return false;
      db.prepare(
        "INSERT INTO push_deliveries VALUES (?, ?, ?, ?) ON CONFLICT(device,lesson) DO UPDATE SET status=excluded.status, time=excluded.time",
      ).run(device, lesson, "sending", now);
      return true;
    },
    finishPush(endpoint, lesson, now, success) {
      if (success)
        db.prepare(
          "UPDATE push_deliveries SET status=?,time=? WHERE device=? AND lesson=?",
        ).run("sent", now, digest(endpoint), lesson);
      else
        db.prepare(
          "DELETE FROM push_deliveries WHERE device=? AND lesson=?",
        ).run(digest(endpoint), lesson);
    },
  };
}
