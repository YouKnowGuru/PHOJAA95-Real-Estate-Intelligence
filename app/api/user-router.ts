import { z } from "zod";
import { eq, ne, like, desc, count, and, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { createRouter, adminQuery, staffQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { localUsers } from "@db/schema";
import { passwordSchema } from "./local-auth-router";

export const userRouter = createRouter({
  list: adminQuery
    .input(
      z.object({
        search: z.string().optional(),
        role: z.enum(["staff", "admin"]).optional(),
        status: z.enum(["active", "inactive", "locked"]).optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];

      if (input.search) {
        conditions.push(
          or(
            like(localUsers.fullName, `%${input.search}%`),
            like(localUsers.email, `%${input.search}%`)
          )
        );
      }
      if (input.role) conditions.push(eq(localUsers.role, input.role));
      if (input.status) conditions.push(eq(localUsers.status, input.status));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const totalResult = await db.select({ count: count() }).from(localUsers).where(whereClause);
      const total = totalResult[0]?.count || 0;

      const offset = (input.page - 1) * input.limit;

      const results = await db
        .select({
          id: localUsers.id,
          fullName: localUsers.fullName,
          email: localUsers.email,
          role: localUsers.role,
          phone: localUsers.phone,
          address: localUsers.address,
          profileImage: localUsers.profileImage,
          status: localUsers.status,
          pfNumber: localUsers.pfNumber,
          pfPercentage: localUsers.pfPercentage,
          employeeId: localUsers.employeeId,
          lastLoginAt: localUsers.lastLoginAt,
          loginAttempts: localUsers.loginAttempts,
          createdAt: localUsers.createdAt,
          updatedAt: localUsers.updatedAt,
        })
        .from(localUsers)
        .where(whereClause)
        .orderBy(desc(localUsers.createdAt))
        .limit(input.limit)
        .offset(offset);

      return { items: results, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  getById: adminQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const users = await db
        .select({
          id: localUsers.id,
          fullName: localUsers.fullName,
          email: localUsers.email,
          role: localUsers.role,
          phone: localUsers.phone,
          address: localUsers.address,
          profileImage: localUsers.profileImage,
          status: localUsers.status,
          pfNumber: localUsers.pfNumber,
          pfPercentage: localUsers.pfPercentage,
          employeeId: localUsers.employeeId,
          lastLoginAt: localUsers.lastLoginAt,
          loginAttempts: localUsers.loginAttempts,
          createdAt: localUsers.createdAt,
          updatedAt: localUsers.updatedAt,
        })
        .from(localUsers)
        .where(eq(localUsers.id, input.id))
        .limit(1);

      return users[0] || null;
    }),

  create: adminQuery
    .input(
      z.object({
        fullName: z.string().min(2).max(255),
        email: z.string().email(),
        password: passwordSchema,
        role: z.enum(["staff", "admin"]),
        phone: z.string().optional(),
        address: z.string().optional(),
        pfNumber: z.string().optional(),
        pfPercentage: z.string().optional(),
        employeeId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db.select().from(localUsers).where(eq(localUsers.email, input.email)).limit(1);
      if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });

      const hashedPassword = await bcrypt.hash(input.password, 12);
      const result = await db.insert(localUsers).values({
        ...input,
        password: hashedPassword,
        status: "active",
      });

      return { id: Number(result[0].insertId) };
    }),

  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        fullName: z.string().min(2).max(255).optional(),
        email: z.string().email().optional(),
        role: z.enum(["staff", "admin"]).optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        profileImage: z.string().optional(),
        status: z.enum(["active", "inactive", "locked"]).optional(),
        pfNumber: z.string().optional(),
        pfPercentage: z.string().optional(),
        employeeId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const db = getDb();

      const existing = await db.select().from(localUsers).where(eq(localUsers.id, id)).limit(1);
      if (existing.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (data.role && existing[0].role === "admin" && data.role !== "admin") {
        const otherAdmin = await db.select({ id: localUsers.id }).from(localUsers)
          .where(and(eq(localUsers.role, "admin"), ne(localUsers.id, id)))
          .limit(1);
        if (otherAdmin.length === 0) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot demote the last admin" });
        }
      }

      // Check email uniqueness if email is being updated
      if (data.email) {
        const duplicate = await db
          .select()
          .from(localUsers)
          .where(and(eq(localUsers.email, data.email), ne(localUsers.id, id)))
          .limit(1);
        if (duplicate.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: "Email is already in use by another user" });
        }
      }

      await db.update(localUsers).set(data).where(eq(localUsers.id, id));
      return { success: true };
    }),

  resetPassword: adminQuery
    .input(z.object({ id: z.number(), newPassword: passwordSchema }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const hashedPassword = await bcrypt.hash(input.newPassword, 12);
      await db.update(localUsers)
        .set({ password: hashedPassword, loginAttempts: 0, status: "active" })
        .where(eq(localUsers.id, input.id));
      return { success: true };
    }),

  unlockAccount: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(localUsers)
        .set({ status: "active", loginAttempts: 0 })
        .where(eq(localUsers.id, input.id));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const userToDelete = await db.select().from(localUsers).where(eq(localUsers.id, input.id)).limit(1);
      if (userToDelete.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (userToDelete[0].role === "admin") {
        const otherAdmin = await db.select({ id: localUsers.id }).from(localUsers)
          .where(and(eq(localUsers.role, "admin"), ne(localUsers.id, input.id)))
          .limit(1);
        if (otherAdmin.length === 0) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete the last admin" });
        }
      }

      try {
        await db.delete(localUsers).where(eq(localUsers.id, input.id));
      } catch (err: any) {
        if (err.message?.includes("FOREIGN KEY") || err.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
          throw new TRPCError({ code: "CONFLICT", message: "Cannot delete user with existing records (properties, attendance, etc.)" });
        }
        throw err;
      }

      return { success: true };
    }),

  updateProfile: staffQuery
    .input(
      z.object({
        fullName: z.string().min(2).max(255).optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        pfNumber: z.string().optional(),
        employeeId: z.string().optional(),
        profileImage: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      await db.update(localUsers).set(input).where(eq(localUsers.id, userId));
      return { success: true };
    }),
});
