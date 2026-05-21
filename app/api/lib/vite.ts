import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";
import { PUBLIC_DIR, DIST_DIR, UPLOAD_DIR } from "./paths";
import { logger } from "./logger";

type App = Hono<{ Bindings: HttpBindings }>;

const mimeTypes: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || "application/octet-stream";
}

export function serveStaticFiles(app: App) {
  logger.info("Serving static files", {
    publicDir: PUBLIC_DIR,
    distDir: DIST_DIR,
    uploadDir: UPLOAD_DIR,
  });

  // ─── Explicit handler for uploaded files ────────────────────────────
  // This runs BEFORE the catch-all serveStatic so uploads are served
  // reliably even if the bundled dist path is mis-resolved.
  app.use("/uploads/*", async (c, next) => {
    const reqPath = c.req.path;
    const filePath = path.join(PUBLIC_DIR, reqPath);

    // Security: ensure file is within public dir
    const resolvedFile = path.resolve(filePath);
    const resolvedPublic = path.resolve(PUBLIC_DIR);
    if (!resolvedFile.startsWith(resolvedPublic)) {
      logger.warn("Upload path traversal blocked", { reqPath, resolvedFile });
      return c.json({ error: "Forbidden" }, 403);
    }

    if (!fs.existsSync(filePath)) {
      logger.warn("Upload file not found", { reqPath, filePath });
      return await next();
    }

    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        return await next();
      }

      const contentType = getContentType(filePath);
      const file = fs.readFileSync(filePath);

      logger.debug("Serving upload file", {
        reqPath,
        filePath,
        size: file.length,
        contentType,
      });

      return c.newResponse(file, 200, {
        "Content-Type": contentType,
        "Content-Length": file.length.toString(),
        "Cache-Control": "public, max-age=86400",
      });
    } catch (err) {
      logger.error("Error serving upload file", {
        reqPath,
        filePath,
        error: String(err),
      });
      return await next();
    }
  });

  // ─── Serve built Vite assets ────────────────────────────────────────
  app.use("*", serveStatic({ root: DIST_DIR }));

  // ─── Not found handler (SPA fallback) ───────────────────────────────
  app.notFound((c) => {
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
