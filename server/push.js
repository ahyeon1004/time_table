import webpush from "web-push";
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { resolve } from "node:path";
import { readAuthConfig } from "./auth.js";
import { createAuthStore } from "./auth-store.js";
import { createPushService as core } from "./push-core.js";
export {
  validSubscription,
  validPushSettings,
  seoulClock,
  duePush,
} from "./push-core.js";
export async function pushConfig(root) {
  const auth = await readAuthConfig(root);
  let values = {};
  try {
    const env = await readFile(resolve(root, ".env.local"), "utf8");
    for (const line of env.split(/\r?\n/)) {
      const m = line.match(/^(WEB_PUSH_[A-Z_]+)=(.*)$/);
      if (m) values[m[1]] = m[2].trim();
    }
  } catch {}
  const subject = process.env.WEB_PUSH_SUBJECT || values.WEB_PUSH_SUBJECT;
  if (
    !auth.ready ||
    !subject ||
    !/^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(subject)
  )
    return { ready: false };
  const path = resolve(root, ".data/web-push-keys.json");
  await mkdir(resolve(root, ".data"), { recursive: true, mode: 0o700 });
  let keys;
  try {
    keys = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    keys = webpush.generateVAPIDKeys();
    try {
      await writeFile(path, JSON.stringify(keys), { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      keys = JSON.parse(await readFile(path, "utf8"));
    }
  }
  await chmod(path, 0o600);
  return { ready: true, origin: auth.origin, subject, ...keys };
}

export function createPushService(options = {}) {
  const root = options.root ?? process.cwd();
  return core({
    ...options,
    getConfig: options.getConfig ?? (() => pushConfig(root)),
    storeFactory:
      options.storeFactory ??
      (() => createAuthStore(resolve(root, ".data/auth.sqlite"))),
    send:
      options.send ??
      ((subscription, payload, config) =>
        webpush.sendNotification(subscription, JSON.stringify(payload), {
          TTL: 300,
          timeout: 10_000,
          urgency: "high",
          vapidDetails: {
            subject: config.subject,
            publicKey: config.publicKey,
            privateKey: config.privateKey,
          },
        })),
  });
}
