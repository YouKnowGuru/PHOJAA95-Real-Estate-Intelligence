import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

type App = Hono<{ Bindings: HttpBindings }>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let appDir = path.resolve(__dirname, "..");
if (!fs.existsSync(path.join(appDir, "public"))) {
  appDir = path.resolve(__dirname, "../..");
}
const distPath = path.join(appDir, "dist/public");
const publicPath = path.join(appDir, "public");

export function serveStaticFiles(app: App) {

  // Ensure public folder exists
  if (!fs.existsSync(publicPath)) {
    fs.mkdirSync(publicPath, { recursive: true });
  }

  // Serve uploaded files from public/uploads (explicit handler for reliability)
  app.use("/uploads/*", async (c, next) => {
    const reqPath = c.req.path;
    const filePath = path.join(publicPath, reqPath);

    // Security: ensure file is within publicPath
    const resolvedFile = path.resolve(filePath);
    const resolvedPublic = path.resolve(publicPath);
    if (!resolvedFile.startsWith(resolvedPublic)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    if (!fs.existsSync(filePath)) {
      return await next();
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";

    const file = fs.readFileSync(filePath);
    return c.newResponse(file, 200, {
      "Content-Type": contentType,
      "Content-Length": file.length.toString(),
    });
  });

  // Serve built assets
  app.use("*", serveStatic({ root: distPath }));

  // Not found handler
  app.notFound((c) => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }
    const indexPath = path.join(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, "utf-8");
      return c.html(content);
    }
    return c.text("App not ready. Run npm run build.", 503);
  });
}