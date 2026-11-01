import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createTimetableMiddleware, readApiKey } from "./server/neis.js";

function timetableApi() {
  const middleware = createTimetableMiddleware({
    getApiKey: () => readApiKey(process.cwd()),
  });
  return {
    name: "neis-timetable-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
export default defineConfig({
  plugins: [react(), tailwindcss(), timetableApi()],
});
