let promptEvent = null;
const standalone = window.matchMedia("(display-mode: standalone)");
const appleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let installed = standalone.matches || navigator.standalone === true;
let available = false;
const listeners = new Set();
function update() {
  available = !!promptEvent && !installed;
  for (const listener of listeners) listener();
}
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  promptEvent = event;
  update();
});
window.addEventListener("appinstalled", () => {
  installed = true;
  promptEvent = null;
  update();
});
standalone.addEventListener("change", (event) => {
  installed = event.matches || navigator.standalone === true;
  update();
});
export const subscribeInstall = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const canInstall = () => available;
export const needsAppleInstallHelp = () => appleMobile && !installed && !available;
export async function installApp() {
  const event = promptEvent;
  if (!event || installed) return;
  // Invoke the browser prompt inside the click's user activation.
  const result = event.prompt();
  promptEvent = null;
  update();
  await result;
}
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => { /* Installation can be retried on the next page load. */ });
  }, { once: true });
}
