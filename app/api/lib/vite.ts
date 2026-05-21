import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";
import { PUBLIC_DIR, DIST_DIR, UPLOAD_DIR } from "./paths";
import { logger } from "./logger";
import { createUploadMiddleware } from "./serve-upload";

type App = Hono<{ Bindings: HttpBindings }>;

export function serveStaticFiles(app: App) {
  logger.info("Serving static files", {
    publicDir: PUBLIC_DIR,
    distDir: DIST_DIR,
    uploadDir: UPLOAD_DIR,
  });

  app.use("/uploads/*", createUploadMiddleware());

  // ─── Serve built Vite assets ────────────────────────────────────────
  app.use("*", serveStatic({ root: DIST_DIR }));

  // ─── Not found handler (SPA fallback) ───────────────────────────────
  app.notFound((c) => {
    if (c.req.path.startsWith("/uploads/")) {
      return c.text("File not found", 404, {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store",
      });
    }
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }
    const indexPath = path.join(DIST_DIR, "index.html");
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, "utf-8");
      return c.html(content);
    }
    return c.text("App not ready. Run npm run build.", 503);
  });
}
