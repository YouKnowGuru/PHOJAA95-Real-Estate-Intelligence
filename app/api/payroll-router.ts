import { z } from "zod";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery, staffQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { payroll, localUsers } from "@db/schema";

function parseMoney(value: string): number {
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Invalid monetary value: ${value}` });
  }
  return parsed;
}

export const payrollRouter = createRouter({
  create: adminQuery
    .input(
      z.object({
        userId: z.number(),
        month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM"),
        baseSalary: z.string().min(1),
        bonus: z.string().default("0"),
        deduction: z.string().default("0"),
        pfPercentage: z.string().optional(),
        notes: z.string().optional(),
        deductionNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      
      // Use provided percentage or fetch user's default PF percentage
      let pfPercent: number;
      if (input.pfPercentage) {
        pfPercent = parseMoney(input.pfPercentage);
      } else {
        const [user] = await db.select({ pfPercentage: localUsers.pfPercentage })
          .from(localUsers)
          .where(eq(localUsers.id, input.userId))
          .limit(1);
        if (!user) throw new TRPCError({ code: "BAD_REQUEST", message: "User not found" });
        const rawPf = parseFloat(user.pfPercentage || "0");
        pfPercent = Number.isNaN(rawPf) ? 0 : rawPf;
      }
      const base = parseMoney(input.baseSalary);
      const bonus = parseMoney(input.bonus);
      const deduction = parseMoney(input.deduction);
      
      // Calculate PF Deduction
      const pfDeductionAmount = (base * pfPercent) / 100;
      const netSalary = (base + bonus - deduction - pfDeductionAmount).toFixed(2);
      const pfDeduction = pfDeductionAmount.toFixed(2);

      return await db.transaction(async (tx) => {
        const existing = await tx
          .select()
          .from(payroll)
          .where(and(eq(payroll.userId, input.userId), eq(payroll.month, input.month)))
          .limit(1);

        if (existing.length > 0) {
          await tx.update(payroll)
            .set({
              baseSalary: input.baseSalary,
              bonus: input.bonus,
              deduction: input.deduction,
              pfDeduction,
              pfPercentage: pfPercent.toString(),
              netSalary,
              notes: input.notes,
              deductionNotes: input.deductionNotes,
            })
            .where(eq(payroll.id, existing[0].id));

          return { id: existing[0].id, netSalary, pfDeduction };
        }

        const result = await tx.insert(payroll).values({
          userId: input.userId,
          month: input.month,
          baseSalary: input.baseSalary,
          bonus: input.bonus,
          deduction: input.deduction,
          pfDeduction,
          pfPercentage: pfPercent.toString(),
          netSalary,
          paymentStatus: "pending",
          notes: input.notes,
          deductionNotes: input.deductionNotes,
        });

        return { id: Number(result[0].insertId), netSalary, pfDeduction };
      });
    }),

  list: adminQuery
    .input(
      z.object({
        userId: z.number().optional(),
        month: z.string().optional(),
        status: z.enum(["pending", "paid"]).optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
      }).default(() => ({ page: 1, limit: 12 }))
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];

      if (input.userId) conditions.push(eq(payroll.userId, input.userId));
      if (input.month) conditions.push(eq(payroll.month, input.month));
      if (input.status) conditions.push(eq(payroll.paymentStatus, input.status));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const totalResult = await db.select({ count: count() }).from(payroll).where(whereClause);
      const total = totalResult[0]?.count || 0;

      const page = input.page || 1;
      const limit = Math.max(1, input.limit || 20);

      const results = await db
        .select({
          id: payroll.id,
          userId: payroll.userId,
          month: payroll.month,
          baseSalary: payroll.baseSalary,
          bonus: payroll.bonus,
          deduction: payroll.deduction,
          pfDeduction: payroll.pfDeduction,
          pfPercentage: payroll.pfPercentage,
          netSalary: payroll.netSalary,
          paymentStatus: payroll.paymentStatus,
          paidAt: payroll.paidAt,
          notes: payroll.notes,
          deductionNotes: payroll.deductionNotes,
          createdAt: payroll.createdAt,
          userName: localUsers.fullName,
          userEmail: localUsers.email,
          pfNumber: localUsers.pfNumber,
          employeeId: localUsers.employeeId,
        })
        .from(payroll)
        .leftJoin(localUsers, eq(payroll.userId, localUsers.id))
        .where(whereClause)
        .orderBy(desc(payroll.createdAt))
        .limit(limit)
        .offset((page - 1) * limit);

      return { items: results, total, page, limit, totalPages: Math.ceil(total / limit) };
    }),

  markPaid: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [record] = await db.select().from(payroll).where(eq(payroll.id, input.id)).limit(1);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Payroll record not found" });
      await db.update(payroll)
        .set({
          paymentStatus: "paid",
          paidAt: new Date(),
          paidBy: ctx.unifiedUser!.id,
        })
        .where(eq(payroll.id, input.id));

      return { success: true };
    }),

  myPayroll: staffQuery
    .input(
      z.object({
        month: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(12),
      }).default(() => ({ page: 1, limit: 12 }))
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const conditions = [eq(payroll.userId, userId)];

      if (input.month) conditions.push(eq(payroll.month, input.month));

      const results = await db
        .select({
          id: payroll.id,
          userId: payroll.userId,
          month: payroll.month,
          baseSalary: payroll.baseSalary,
          bonus: payroll.bonus,
          deduction: payroll.deduction,
          pfDeduction: payroll.pfDeduction,
          pfPercentage: payroll.pfPercentage,
          netSalary: payroll.netSalary,
          paymentStatus: payroll.paymentStatus,
          paidAt: payroll.paidAt,
          notes: payroll.notes,
          deductionNotes: payroll.deductionNotes,
          createdAt: payroll.createdAt,
          userName: localUsers.fullName,
          pfNumber: localUsers.pfNumber,
          employeeId: localUsers.employeeId,
        })
        .from(payroll)
        .leftJoin(localUsers, eq(payroll.userId, localUsers.id))
        .where(and(...conditions))
        .orderBy(desc(payroll.month))
        .limit(input.limit || 12)
        .offset(((input.page || 1) - 1) * (input.limit || 12));

      return results;
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [record] = await db.select().from(payroll).where(eq(payroll.id, input.id)).limit(1);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Payroll record not found" });
      await db.delete(payroll).where(eq(payroll.id, input.id));
      return { success: true };
    }),

  salarySummary: adminQuery
    .input(z.object({ month: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();

      const result = await db
        .select({
          totalBase: sql<string>`COALESCE(SUM(${payroll.baseSalary}), 0)`,
          totalBonus: sql<string>`COALESCE(SUM(${payroll.bonus}), 0)`,
          totalDeduction: sql<string>`COALESCE(SUM(${payroll.deduction}), 0)`,
          totalPF: sql<string>`COALESCE(SUM(${payroll.pfDeduction}), 0)`,
          totalNet: sql<string>`COALESCE(SUM(${payroll.netSalary}), 0)`,
          totalPaid: sql<number>`SUM(CASE WHEN ${payroll.paymentStatus} = 'paid' THEN 1 ELSE 0 END)`,
          totalPending: sql<number>`SUM(CASE WHEN ${payroll.paymentStatus} = 'pending' THEN 1 ELSE 0 END)`,
        })
        .from(payroll)
        .where(eq(payroll.month, input.month));

      return result[0] || {
        totalBase: "0",
        totalBonus: "0",
        totalDeduction: "0",
        totalPF: "0",
        totalNet: "0",
        totalPaid: 0,
        totalPending: 0,
      };
    }),
});
