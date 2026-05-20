import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

type App = Hono<{ Bindings: HttpBindings }>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "../.."); // from api/lib/ up to app/
const distPath = path.join(appDir, "dist/public");
const publicPath = path.join(appDir, "public");

export function serveStaticFiles(app: App) {

  // Ensure public folder exists
  if (!fs.existsSync(publicPath)) {
    fs.mkdirSync(publicPath, { recursive: true });
  }

  // Serve uploaded files from public/uploads
  app.use("/uploads", serveStatic({ root: publicPath }));

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