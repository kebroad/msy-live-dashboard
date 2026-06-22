import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// In dev, serve the committed CSV (which lives at <repo>/data) so the app can
// fetch it the same way it will in production (where the workflow copies it
// into the build output).
function serveDataDir() {
  return {
    name: "serve-data-dir",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || "").split("?")[0];
        const match = url.match(/\/data\/.+/);
        if (match) {
          const filePath = path.join(process.cwd(), match[0]);
          if (fs.existsSync(filePath)) {
            res.setHeader("Content-Type", "text/csv");
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  // Served from https://<user>.github.io/msy-live-dashboard/
  base: "/msy-live-dashboard/",
  plugins: [react(), serveDataDir()],
});
