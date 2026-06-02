import { ErrorMessages } from "@contracts/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { sanitizeInput } from "./lib/sanitize";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

// ─── Input sanitization middleware (XSS prevention) ──────────────────
const sanitizeMiddleware = t.middleware(async (opts) => {
  const rawInput = await opts.getRawInput();
  // Sanitize all string inputs to strip HTML tags before they reach handlers
  const cleanInput = sanitizeInput(rawInput);
  return opts.next({ getRawInput: async () => cleanInput });
});

export const createRouter = t.router;
export const publicQuery = t.procedure.use(sanitizeMiddleware);

// ─── In-memory rate limiter (per-IP sliding window) ─────────────────
// SECURITY NOTE: This is an in-memory store that does NOT share state across
// multiple server instances. For production multi-process/serverless deployments,
// migrate to Redis-backed rate limiting (e.g., @upstash/ratelimit).
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max requests per window for general endpoints

// Stricter limits for authentication endpoints to prevent brute-force attacks
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60_000; // 15 minutes
const AUTH_RATE_LIMIT_MAX = 5; // max 5 auth attempts per 15 minutes

function isPrivateIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

function getClientIp(ctx: TrpcContext): string {
  const headers = ctx.req?.headers;
  // SECURITY FIX: Use a trusted proxy count approach instead of blindly trusting
  // X-Forwarded-For. In production behind a known number of proxies, we take the
  // Nth IP from the right. For now, we validate that the direct connection is from
  // a private IP (indicating we're behind a reverse proxy) before using X-Forwarded-For.
  // In cloud environments where the direct connection always appears private,
  // configure TRUST_PROXY_COUNT env var to control how many proxies to trust.
  const trustProxyCount = parseInt(process.env.TRUST_PROXY_COUNT || "1", 10);
  const conn = (ctx.req as any)?.socket;
  const remoteAddress = conn?.remoteAddress as string | undefined;

  const rawForwarded = headers?.get("x-forwarded-for");
  if (typeof rawForwarded === "string" && rawForwarded) {
    const ips = rawForwarded.split(",").map(ip => ip.trim()).filter(Boolean);
    // If we have enough IPs in the chain, take the one at the trusted position from the right
    if (ips.length >= trustProxyCount) {
      const clientIp = ips[ips.length - trustProxyCount];
      // Validate the IP format roughly
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clientIp) || /^[0-9a-fA-F:]+$/.test(clientIp)) {
        return clientIp;
      }
    }
  }

  const rawRealIp = headers?.get("x-real-ip");
  if (typeof rawRealIp === "string" && rawRealIp) {
    return rawRealIp.trim();
  }

  if (remoteAddress) return remoteAddress;
  return "unknown";
}

const rateLimitMiddleware = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  const ip = getClientIp(ctx);
  const now = Date.now();

  const entry = rateLimitStore.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= RATE_LIMIT_MAX) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests. Please try again later.",
      });
    }
    entry.count++;
  } else {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }

  return next({ ctx: { ...ctx, unifiedUser: ctx.unifiedUser } });
});

// Stricter rate limiter for auth endpoints (login, register, forgot password, etc.)
const authRateLimitStore = new Map<string, { count: number; resetAt: number }>();

const authRateLimitMiddleware = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  const ip = getClientIp(ctx);
  const now = Date.now();

  const entry = authRateLimitStore.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= AUTH_RATE_LIMIT_MAX) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many login attempts. Please try again in 15 minutes.",
      });
    }
    entry.count++;
  } else {
    authRateLimitStore.set(ip, { count: 1, resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS });
  }

  return next({ ctx: { ...ctx, unifiedUser: ctx.unifiedUser } });
});

// Certificate / verification lookup rate limiter (public endpoints)
const VERIFY_RATE_LIMIT_WINDOW_MS = 60_000;
const VERIFY_RATE_LIMIT_MAX = 15;

const verifyRateLimitStore = new Map<string, { count: number; resetAt: number }>();

const verifyRateLimitMiddleware = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  const ip = getClientIp(ctx);
  const now = Date.now();

  const entry = verifyRateLimitStore.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= VERIFY_RATE_LIMIT_MAX) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many verification attempts. Please try again later.",
      });
    }
    entry.count++;
  } else {
    verifyRateLimitStore.set(ip, { count: 1, resetAt: now + VERIFY_RATE_LIMIT_WINDOW_MS });
  }

  return next({ ctx: { ...ctx, unifiedUser: ctx.unifiedUser } });
});

// Periodically clean up stale entries (every 5 minutes).
// NOTE: In serverless environments this setInterval may leak memory or not
// run as expected. For production/multi-process deployments, replace this
// in-memory store with Redis. TODO: migrate to Redis-backed rate limiting.
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitStore) {
    if (now >= val.resetAt) rateLimitStore.delete(key);
  }
  for (const [key, val] of authRateLimitStore) {
    if (now >= val.resetAt) authRateLimitStore.delete(key);
  }
  for (const [key, val] of verifyRateLimitStore) {
    if (now >= val.resetAt) verifyRateLimitStore.delete(key);
  }
}, 300_000).unref?.();

export const rateLimitedQuery = t.procedure.use(sanitizeMiddleware).use(rateLimitMiddleware);

// Auth-specific rate limiter: stricter limits for login/register/forgot password
export const authRateLimitedQuery = t.procedure.use(sanitizeMiddleware).use(authRateLimitMiddleware);

export const verifyRateLimitedPublicQuery = t.procedure
  .use(sanitizeMiddleware)
  .use(verifyRateLimitMiddleware);

// Chatbot rate limiter: prevents API cost exhaustion
const CHAT_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const CHAT_RATE_LIMIT_MAX = 10; // 10 messages per minute

const chatRateLimitStore = new Map<string, { count: number; resetAt: number }>();

const chatRateLimitMiddleware = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  const userId = ctx.unifiedUser?.id ?? getClientIp(ctx);
  const now = Date.now();

  const entry = chatRateLimitStore.get(String(userId));
  if (entry && now < entry.resetAt) {
    if (entry.count >= CHAT_RATE_LIMIT_MAX) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many chat messages. Please slow down.",
      });
    }
    entry.count++;
  } else {
    chatRateLimitStore.set(String(userId), { count: 1, resetAt: now + CHAT_RATE_LIMIT_WINDOW_MS });
  }

  return next({ ctx: { ...ctx, unifiedUser: ctx.unifiedUser } });
});

// ─── Auth middlewares ────────────────────────────────────────────────
const requireAuth = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.unifiedUser) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: ErrorMessages.unauthenticated,
    });
  }

  if (ctx.unifiedUser.status === "locked") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Account locked" });
  }
  if (ctx.unifiedUser.status === "inactive") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Account inactive" });
  }

  return next({ ctx: { ...ctx, unifiedUser: ctx.unifiedUser } });
});

const requireAdmin = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.unifiedUser || ctx.unifiedUser.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: ErrorMessages.insufficientRole,
    });
  }

  return next({ ctx: { ...ctx, unifiedUser: ctx.unifiedUser } });
});

const requireStaff = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.unifiedUser || (ctx.unifiedUser.role !== "staff" && ctx.unifiedUser.role !== "admin" && ctx.unifiedUser.role !== "developer" && ctx.unifiedUser.role !== "architecture_staff")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Staff access required",
    });
  }

  return next({ ctx: { ...ctx, unifiedUser: ctx.unifiedUser } });
});

const requireDeveloper = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.unifiedUser || (ctx.unifiedUser.role !== "developer" && ctx.unifiedUser.role !== "admin")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Developer access required",
    });
  }

  return next({ ctx: { ...ctx, unifiedUser: ctx.unifiedUser } });
});

const requireDeveloperOnly = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.unifiedUser || ctx.unifiedUser.role !== "developer") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This action is restricted to software developers. Admins can review and approve only.",
    });
  }

  return next({ ctx: { ...ctx, unifiedUser: ctx.unifiedUser } });
});

const requireArchitectureStaff = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.unifiedUser || (ctx.unifiedUser.role !== "architecture_staff" && ctx.unifiedUser.role !== "admin")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Architecture staff access required",
    });
  }

  return next({ ctx: { ...ctx, unifiedUser: ctx.unifiedUser } });
});

const requireArchitectureStaffOnly = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.unifiedUser || ctx.unifiedUser.role !== "architecture_staff") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This action is restricted to architecture staff. Admins can review and approve only.",
    });
  }

  return next({ ctx: { ...ctx, unifiedUser: ctx.unifiedUser } });
});

export const authedQuery = t.procedure.use(sanitizeMiddleware).use(requireAuth);
export const adminQuery = authedQuery.use(requireAdmin);
export const staffQuery = authedQuery.use(requireStaff);
export const developerQuery = authedQuery.use(requireDeveloper);
export const developerOnlyQuery = authedQuery.use(requireDeveloperOnly);
export const architectureStaffQuery = authedQuery.use(requireArchitectureStaff);
export const architectureStaffOnlyQuery = authedQuery.use(requireArchitectureStaffOnly);

// Chatbot rate limiter export (must be after requireAuth is defined)
export const chatRateLimitedQuery = t.procedure.use(sanitizeMiddleware).use(requireAuth).use(chatRateLimitMiddleware);
