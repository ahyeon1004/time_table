import { createPushService } from "./server/push.js";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createTimetableMiddleware, readApiKey } from "./server/neis.js";

import { createAuthMiddleware } from "./server/auth.js";

function timetableApi() {
  const auth = createAuthMiddleware();
  const middleware = createTimetableMiddleware({
    getApiKey: () => readApiKey(process.cwd()),
  });
  const push = createPushService({ loadTimetable: middleware.load });
  const attach = (server) => {
    server.middlewares.use(push.middleware);
    server.middlewares.use(auth);
    server.middlewares.use(middleware);
    push.start();
    server.httpServer?.once("close", () => push.close());
  };
  return {
    name: "neis-timetable-api",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
export default defineConfig({
  plugins: [react(), tailwindcss(), timetableApi()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: 5173, strictPort: true },
});
