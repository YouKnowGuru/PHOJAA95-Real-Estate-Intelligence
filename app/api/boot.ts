import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { serve } from "@hono/node-server";
import { serveStaticFiles } from "./lib/vite";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { closeDb } from "./queries/connection";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { Paths } from "@contracts/constants";
import { createUploadMiddleware, handleApiFileRequest } from "./lib/serve-upload";
import { ensureSchemaPatches } from "./lib/ensure-schema";

const app = new Hono<{ Bindings: HttpBindings }>();

let patchesApplied = false;

// Apply DB patches lazily on first request (avoids top-level await for Passenger compatibility)
async function applySchemaPatches() {
  if (patchesApplied) return;
  patchesApplied = true;
  try {
    await ensureSchemaPatches();
  } catch (err) {
    logger.error("Schema patches failed at startup — login may fail until DB is fixed", {
      error: String(err),
    });
  }
}

// ─── Request logging ─────────────────────────────────────────────────
app.use("*", async (c, next) => {
  await applySchemaPatches();
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const reqId = crypto.randomUUID();

  c.header("X-Request-Id", reqId);

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  const meta = { method, path, status, durationMs: duration, ip, reqId };
  if (status >= 500) {
    logger.error("Request failed", meta);
  } else if (status >= 400) {
    logger.warn("Request error", meta);
  } else {
    logger.info("Request completed", meta);
  }
});

// ─── CORS ───────────────────────────────────────────────────────────
app.use("*", cors({
  origin: env.isProduction
    ? [env.appUrl]
    : ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Cookie"],
  maxAge: 86400,
}));

// ─── Security headers ───────────────────────────────────────────────
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("X-XSS-Protection", "1; mode=block");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Security: Content Security Policy.
  // Note: 'unsafe-inline' for scripts is needed for Vite/React in development.
  // In production with a proper build, consider using CSP nonces or hashes.
  // 'unsafe-eval' is required for some React/Vite features.
  c.res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://res.cloudinary.com https://*.cloudinary.com",
      "font-src 'self'",
      "connect-src 'self' https://api.cloudinary.com wss: ws:",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );
  if (env.isProduction) {
    c.res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
});

// ─── Health checks ──────────────────────────────────────────────────
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));
app.get("/ready", async (c) => {
  try {
    // Basic DB connectivity check
    const { getDb } = await import("./queries/connection");
    const db = getDb();
    await db.execute("SELECT 1");
    return c.json({ status: "ready", db: "connected" });
  } catch (err) {
    logger.error("Readiness check failed", { error: String(err) });
    return c.json({ status: "not_ready", db: "disconnected" }, 503);
  }
});

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }}));
app.get(Paths.oauthCallback, createOAuthCallbackHandler());
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
// ─── Dedicated file download endpoint (reliable fallback) ───────────
app.get("/api/file/*", (c) => handleApiFileRequest(c));

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

// ─── Serve uploaded files in BOTH dev and production ────────────────
app.use("/uploads/*", createUploadMiddleware());

export default app;

if (env.isProduction) {
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  const server = serve({ fetch: app.fetch, port }, () => {
    logger.info(`Server running on http://localhost:${port}/`);
  });

  // ─── Graceful shutdown ────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    server.close(async () => {
      logger.info("HTTP server closed");
      try {
        await closeDb();
        logger.info("Database connections closed");
      } catch (err) {
        logger.error("Error closing database", { error: String(err) });
      }
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Handle uncaught exceptions
  process.on("uncaughtException", (err) => {
    // Security: In production, do not log full stack traces to the main logger.
    // Stack traces can reveal internal file paths, library versions, and architecture.
    // Log only the error message with a correlation ID; send full stacks to a
    // secure error tracking service (e.g., Sentry) if available.
    const errorId = crypto.randomUUID();
    if (env.isProduction) {
      logger.error("Uncaught exception", { errorId, error: err.message });
      // Store full stack trace in a separate secure log or error tracking service
      console.error(`[ERROR:${errorId}]`, err.stack); // eslint-disable-line no-console
    } else {
      logger.error("Uncaught exception", { errorId, error: err.message, stack: err.stack });
    }
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", { reason: String(reason) });
  });
}
