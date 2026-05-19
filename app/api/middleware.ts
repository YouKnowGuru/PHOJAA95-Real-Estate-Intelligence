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
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max requests per window

function getClientIp(ctx: TrpcContext): string {
  const headers = ctx.req?.headers;
  const raw = headers?.get("x-forwarded-for") || headers?.get("x-real-ip");
  if (typeof raw === "string" && raw) {
    return raw.split(",")[0].trim();
  }
  // fallback to connection remote address
  const conn = (ctx.req as any)?.socket;
  if (conn?.remoteAddress) return conn.remoteAddress;
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

// Periodically clean up stale entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitStore) {
    if (now >= val.resetAt) rateLimitStore.delete(key);
  }
}, 300_000).unref?.();

export const rateLimitedQuery = t.procedure.use(sanitizeMiddleware).use(rateLimitMiddleware);

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

  if (!ctx.unifiedUser || (ctx.unifiedUser.role !== "staff" && ctx.unifiedUser.role !== "admin")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Staff access required",
    });
  }

  return next({ ctx: { ...ctx, unifiedUser: ctx.unifiedUser } });
});

export const authedQuery = t.procedure.use(sanitizeMiddleware).use(requireAuth);
export const adminQuery = authedQuery.use(requireAdmin);
export const staffQuery = authedQuery.use(requireStaff);
