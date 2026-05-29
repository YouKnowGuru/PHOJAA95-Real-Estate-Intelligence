import { z } from "zod";
import bcrypt from "bcryptjs";
import * as jose from "jose";
import * as cookie from "cookie";
import { eq, and, gt, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, rateLimitedQuery, authRateLimitedQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { localUsers, passwordResetTokens } from "@db/schema";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { getSessionCookieOptions } from "./lib/cookies";
import { sendPasswordResetEmail } from "./services/email";
import { randomBytes, createHash } from "crypto";

if (!env.appSecret) {
  throw new Error("APP_SECRET is required");
}
const JWT_SECRET = new TextEncoder().encode(env.appSecret);

// Security: Minimum 8 characters with complexity requirements.
// NIST recommends minimum 8 characters for user-chosen passwords.
export const passwordSchema = z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must be at least 8 characters and contain uppercase, lowercase, and number");

const DEFAULT_SESSION_HOURS = 24;
const REMEMBER_ME_DAYS = 30;

async function signLocalToken(
  payload: { userId: number; email: string; role: string; rememberMe?: boolean }
) {
  const builder = new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt();

  if (payload.rememberMe) {
    builder.setExpirationTime(`${REMEMBER_ME_DAYS}d`);
  } else {
    builder.setExpirationTime(`${DEFAULT_SESSION_HOURS}h`);
  }

  return builder.sign(JWT_SECRET);
}

export async function verifyLocalToken(token: string) {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET, { clockTolerance: 60 });
    return payload as unknown as { userId: number; email: string; role: string; rememberMe?: boolean };
  } catch (err) {
    // Security: Log JWT verification failures for security monitoring.
    // Do NOT log the token itself — only the error type.
    const errorCode = err instanceof Error ? err.name : "UNKNOWN_JWT_ERROR";
    logger.warn("JWT verification failed", { errorCode });
    return null;
  }
}

export async function authenticateLocalRequest(headers: Headers) {
  const cookies = cookie.parse(headers.get("cookie") || "");
  const token = cookies["local_session"];
  if (!token) return null;

  const claim = await verifyLocalToken(token);
  if (!claim) return null;

  const db = getDb();
  const user = await db.select().from(localUsers).where(eq(localUsers.id, claim.userId)).limit(1);
  return user[0] || null;
}

export const localAuthRouter = createRouter({
  register: authRateLimitedQuery
    .input(
      z.object({
        fullName: z.string().min(2).max(255),
        email: z.string().email(),
        password: passwordSchema,
        phone: z.string().optional(),
        address: z.string().optional(),
        role: z.enum(["staff", "admin"]).default("staff"),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Check if any admin already exists (first-admin seed protection)
      const adminCount = await db.select().from(localUsers).where(eq(localUsers.role, "admin")).limit(1);
      const hasExistingAdmin = adminCount.length > 0;

      // Force role to "staff" for public registration — only existing admins can create new admins
      const assignedRole = hasExistingAdmin ? "staff" : input.role;

      const existing = await db.select().from(localUsers).where(eq(localUsers.email, input.email)).limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(input.password, 12);
      const result = await db.insert(localUsers).values({
        fullName: input.fullName,
        email: input.email,
        password: hashedPassword,
        phone: input.phone,
        address: input.address,
        role: assignedRole,
        status: "active",
        loginAttempts: 0,
      });

      return { success: true, userId: Number(result[0].insertId) };
    }),

  login: authRateLimitedQuery
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1, "Password is required"),
        rememberMe: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      let users;
      try {
        users = await db.select().from(localUsers).where(eq(localUsers.email, input.email)).limit(1);
      } catch (err) {
        const errMsg = String(err);
        const errCode = (err as NodeJS.ErrnoException).code;
        logger.error("Login database query failed", { error: errMsg, code: errCode });

        // Security: Never expose internal infrastructure details to clients.
        // Log detailed diagnostics server-side only.
        logger.error("Login database connection failed", {
          error: errMsg,
          code: errCode,
          host: headers.get("host") || "unknown",
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to process login at this time. Please try again later or contact support.",
        });
      }
      if (users.length === 0) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }

      const user = users[0];

      if (user.status === "locked" || user.status === "inactive") {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }

      const validPassword = await bcrypt.compare(input.password, user.password);
      if (!validPassword) {
        await db.update(localUsers)
          .set({ loginAttempts: sql`${localUsers.loginAttempts} + 1` })
          .where(eq(localUsers.id, user.id));

        if ((user.loginAttempts || 0) + 1 >= 5) {
          await db.update(localUsers).set({ status: "locked" }).where(eq(localUsers.id, user.id));
        }

        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }

      await db.update(localUsers)
        .set({ loginAttempts: 0, lastLoginAt: new Date() })
        .where(eq(localUsers.id, user.id));

      const rememberMe = input.rememberMe === true;
      const token = await signLocalToken(
        { userId: user.id, email: user.email, role: user.role, rememberMe }
      );

      const cookieMaxAge = rememberMe ? REMEMBER_ME_DAYS * 86400 : DEFAULT_SESSION_HOURS * 3600;

      const opts = getSessionCookieOptions(ctx.req.headers);
      ctx.resHeaders.append(
        "set-cookie",
        cookie.serialize("local_session", token, {
          httpOnly: opts.httpOnly,
          path: opts.path,
          sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
          secure: opts.secure,
          maxAge: cookieMaxAge,
        })
      );

      return {
        success: true,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          phone: user.phone,
          status: user.status,
          pfNumber: user.pfNumber,
          pfPercentage: user.pfPercentage,
          employeeId: user.employeeId,
        },
      };
    }),

  me: publicQuery.query(async ({ ctx }) => {
    const cookies = cookie.parse(ctx.req.headers.get("cookie") || "");
    const token = cookies["local_session"];
    if (!token) return null;

    const claim = await verifyLocalToken(token);
    if (!claim) return null;

    const db = getDb();
    const users = await db.select().from(localUsers).where(eq(localUsers.id, claim.userId)).limit(1);
    if (users.length === 0) return null;

    const user = users[0];

    // Decode token to get expiration time for session warning
    let sessionExpiresAt: number | null = null;
    try {
      const payload = jose.decodeJwt(token);
      sessionExpiresAt = payload.exp ? (payload.exp as number) * 1000 : null;
    } catch {
      // Token expired or invalid — will be caught by verifyLocalToken above
    }

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      phone: user.phone,
      address: user.address,
      profileImage: user.profileImage,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      pfNumber: user.pfNumber,
      pfPercentage: user.pfPercentage,
      employeeId: user.employeeId,
      sessionExpiresAt,
    };
  }),

  refreshSession: publicQuery.mutation(async ({ ctx }) => {
    const cookies = cookie.parse(ctx.req.headers.get("cookie") || "");
    const token = cookies["local_session"];
    if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "No session found" });

    const claim = await verifyLocalToken(token);
    if (!claim) throw new TRPCError({ code: "UNAUTHORIZED", message: "Session expired" });

    const db = getDb();
    const users = await db.select().from(localUsers).where(eq(localUsers.id, claim.userId)).limit(1);
    if (users.length === 0) throw new TRPCError({ code: "UNAUTHORIZED" });

    const user = users[0];
    const newToken = await signLocalToken(
      { userId: user.id, email: user.email, role: user.role, rememberMe: claim.rememberMe }
    );

    const cookieMaxAge = claim.rememberMe ? REMEMBER_ME_DAYS * 86400 : DEFAULT_SESSION_HOURS * 3600;
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize("local_session", newToken, {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: cookieMaxAge,
      })
    );

    return { success: true, sessionExpiresAt: Date.now() + cookieMaxAge * 1000 };
  }),

  logout: publicQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize("local_session", "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      })
    );
    return { success: true };
  }),

  updateProfile: authedQuery
    .input(
      z.object({
        fullName: z.string().min(2).optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        profileImage: z.string().url().refine((u) => u.startsWith("https://"), { message: "Profile image URL must use HTTPS" }).optional(),
        // Security: Staff must NOT be able to self-assign HR fields.
        // pfNumber, pfPercentage, and employeeId are admin-managed only.
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db.update(localUsers)
        .set(input)
        .where(eq(localUsers.id, ctx.unifiedUser!.id));

      return { success: true };
    }),

  changePassword: authedQuery
    .input(
      z.object({
        currentPassword: z.string(),
        newPassword: passwordSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const users = await db.select().from(localUsers).where(eq(localUsers.id, ctx.unifiedUser!.id)).limit(1);
      if (users.length === 0) throw new TRPCError({ code: "NOT_FOUND" });

      const user = users[0];
      const validPassword = await bcrypt.compare(input.currentPassword, user.password);
      if (!validPassword) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
      }

      const hashedPassword = await bcrypt.hash(input.newPassword, 12);
      await db.update(localUsers)
        .set({ password: hashedPassword })
        .where(eq(localUsers.id, ctx.unifiedUser!.id));

      // TODO: invalidate other sessions via tokenVersion or similar mechanism
      const newToken = await signLocalToken(
        { userId: user.id, email: user.email, role: user.role, rememberMe: false }
      );

      const opts = getSessionCookieOptions(ctx.req.headers);
      ctx.resHeaders.append(
        "set-cookie",
        cookie.serialize("local_session", newToken, {
          httpOnly: opts.httpOnly,
          path: opts.path,
          sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
          secure: opts.secure,
          maxAge: DEFAULT_SESSION_HOURS * 3600,
        })
      );

      // Security: Do NOT return the token in the response body.
      // The httpOnly cookie is already set; returning the token defeats
      // the purpose of httpOnly cookies and exposes it to XSS.
      return { success: true };
    }),

  forgotPassword: authRateLimitedQuery
    .input(
      z.object({
        email: z.string().email(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const users = await db.select().from(localUsers).where(eq(localUsers.email, input.email)).limit(1);

      if (users.length === 0) {
        return { success: true, message: "If the email exists, a password reset link will be sent." };
      }

      const user = users[0];

      if (user.status !== "active") {
        return { success: true, message: "If the email exists, a password reset link will be sent." };
      }

      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token: tokenHash,
        expiresAt,
      });

      if (env.smtpHost && env.smtpUser) {
        try {
          await sendPasswordResetEmail(user.email, token, env.appUrl);
        } catch (err) {
          logger.error("Failed to send password reset email", { email: user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"), error: String(err) });
          // Still return success to prevent email enumeration
        }
      }

      return { success: true, message: "If the email exists, a password reset link will be sent." };
    }),

  resetPassword: authRateLimitedQuery
    .input(
      z.object({
        token: z.string(),
        newPassword: passwordSchema,
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const tokenHash = createHash("sha256").update(input.token).digest("hex");

      const tokens = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, tokenHash),
            eq(passwordResetTokens.used, false),
            gt(passwordResetTokens.expiresAt, new Date())
          )
        )
        .limit(1);

      if (tokens.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired password reset token",
        });
      }

      const tokenRecord = tokens[0];

      const hashedPassword = await bcrypt.hash(input.newPassword, 12);

      await db.update(localUsers)
        .set({ password: hashedPassword, loginAttempts: 0 })
        .where(eq(localUsers.id, tokenRecord.userId));

      await db.update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.token, tokenHash));

      return { success: true, message: "Password has been reset successfully" };
    }),

  verifyResetToken: authRateLimitedQuery
    .input(
      z.object({
        token: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const tokenHash = createHash("sha256").update(input.token).digest("hex");

      const tokens = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, tokenHash),
            eq(passwordResetTokens.used, false),
            gt(passwordResetTokens.expiresAt, new Date())
          )
        )
        .limit(1);

      return { valid: tokens.length > 0 };
    }),
});

export type LocalAuthRouter = typeof localAuthRouter;
