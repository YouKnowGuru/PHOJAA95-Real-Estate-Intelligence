import { z } from "zod";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery, staffQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { attendance, localUsers } from "@db/schema";

/**
 * Get today's date string in Bhutan timezone (YYYY-MM-DD)
 */
function getBhutanDateStr(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" });
}

export const attendanceRouter = createRouter({
  checkIn: staffQuery
    .input(z.object({ notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const now = new Date();

      // Use Bhutan timezone for date
      const localDateStr = getBhutanDateStr(now);

      // Use Bhutan timezone (Asia/Thimphu, UTC+6) for late detection
      const bhutanHour = parseInt(
        now.toLocaleString("en-US", { timeZone: "Asia/Thimphu", hour: "numeric", hour12: false })
      );
      const status: "present" | "late" | "absent" | "half_day" = bhutanHour > 9 ? "late" : "present";

      return await db.transaction(async (tx) => {
        // Security: Use SELECT FOR UPDATE to prevent race conditions (TOCTOU).
        // This locks the rows for this user+date combination during the transaction,
        // preventing duplicate check-ins from concurrent requests.
        const existing = await tx
          .select()
          .from(attendance)
          .where(
            and(
              eq(attendance.userId, userId),
              eq(attendance.date, localDateStr)
            )
          )
          .for("update")
          .limit(1);

        if (existing.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: "Already checked in today" });
        }

        const result = await tx.insert(attendance).values({
          userId,
          date: localDateStr,
          checkIn: now,
          status,
          notes: input.notes,
        });

        return { id: Number(result[0].insertId), status, checkIn: now };
      });
    }),

  checkOut: staffQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.unifiedUser!.id;
    const now = new Date();

    // Use Bhutan timezone for date
    const localDateStr = getBhutanDateStr(now);

    return await db.transaction(async (tx) => {
      // Security: Use SELECT FOR UPDATE to prevent race conditions on checkout
      const existing = await tx
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.userId, userId),
            eq(attendance.date, localDateStr)
          )
        )
        .for("update")
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No check-in found for today" });
      }

      // Prevent duplicate checkout
      if (existing[0].checkOut !== null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Already checked out today" });
      }

      await tx.update(attendance)
        .set({ checkOut: now })
        .where(eq(attendance.id, existing[0].id));

      return { success: true, checkOut: now };
    });
  }),

  myAttendance: staffQuery
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM"), page: z.number().default(1), limit: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;

      const results = await db.select().from(attendance)
        .where(
          and(
            eq(attendance.userId, userId),
            sql`DATE_FORMAT(${attendance.date}, '%Y-%m') = ${input.month}`
          )
        )
        .orderBy(desc(attendance.date))
        .limit(input.limit)
        .offset((input.page - 1) * input.limit);

      const statsResult = await db.select({
        present: sql<number>`SUM(CASE WHEN ${attendance.status} = 'present' THEN 1 ELSE 0 END)`,
        late: sql<number>`SUM(CASE WHEN ${attendance.status} = 'late' THEN 1 ELSE 0 END)`,
        absent: sql<number>`SUM(CASE WHEN ${attendance.status} = 'absent' THEN 1 ELSE 0 END)`,
        halfDay: sql<number>`SUM(CASE WHEN ${attendance.status} = 'half_day' THEN 1 ELSE 0 END)`,
      })
        .from(attendance)
        .where(
          and(
            eq(attendance.userId, userId),
            sql`DATE_FORMAT(${attendance.date}, '%Y-%m') = ${input.month}`
          )
        );

      return { records: results, stats: statsResult[0] || { present: 0, late: 0, absent: 0, halfDay: 0 } };
    }),

  list: adminQuery
    .input(
      z.object({
        userId: z.number().optional(),
        userName: z.string().max(255).optional(),
        month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM").optional(),
        status: z.enum(["present", "late", "absent", "half_day"]).optional(),
        page: z.number().default(1),
        limit: z.number().max(500).default(30),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions: any[] = [];

      if (input.userId) conditions.push(eq(attendance.userId, input.userId));
      if (input.status) conditions.push(eq(attendance.status, input.status));
      if (input.userName) {
        // SECURITY: Sanitize userName to prevent SQL injection via LIKE patterns
        const sanitizedName = input.userName.replace(/[%_]/g, "");
        if (sanitizedName) {
          conditions.push(sql`${localUsers.fullName} LIKE ${`%${sanitizedName}%`}`);
        }
      }
      if (input.month) {
        conditions.push(sql`DATE_FORMAT(${attendance.date}, '%Y-%m') = ${input.month}`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const totalResult = await db.select({ count: count() }).from(attendance).where(whereClause);
      const total = totalResult[0]?.count || 0;

      const results = await db.select({
        id: attendance.id,
        userId: attendance.userId,
        date: attendance.date,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        status: attendance.status,
        notes: attendance.notes,
        userName: localUsers.fullName,
      })
        .from(attendance)
        .leftJoin(localUsers, eq(attendance.userId, localUsers.id))
        .where(whereClause)
        .orderBy(desc(attendance.date))
        .limit(input.limit)
        .offset((input.page - 1) * input.limit);

      return { items: results, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  markAttendance: adminQuery
    .input(z.object({
      userId: z.number(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
      status: z.enum(["present", "absent", "late", "half_day"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      return await db.transaction(async (tx) => {
        // Use direct date string comparison
        const existing = await tx.select().from(attendance)
          .where(
            and(
              eq(attendance.userId, input.userId),
              eq(attendance.date, input.date)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          await tx.update(attendance)
            .set({ status: input.status, notes: input.notes })
            .where(eq(attendance.id, existing[0].id));
        } else {
          await tx.insert(attendance).values({
            userId: input.userId,
            date: input.date,
            status: input.status,
            notes: input.notes,
          });
        }

        return { success: true };
      });
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(attendance).where(eq(attendance.id, input.id));
      return { success: true };
    }),

  monthlySummary: adminQuery
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM") }))
    .query(async ({ input }) => {
      const db = getDb();

      const summary = await db.select({
        userId: attendance.userId,
        userName: localUsers.fullName,
        present: sql<number>`SUM(CASE WHEN ${attendance.status} = 'present' THEN 1 ELSE 0 END)`,
        late: sql<number>`SUM(CASE WHEN ${attendance.status} = 'late' THEN 1 ELSE 0 END)`,
        absent: sql<number>`SUM(CASE WHEN ${attendance.status} = 'absent' THEN 1 ELSE 0 END)`,
        halfDay: sql<number>`SUM(CASE WHEN ${attendance.status} = 'half_day' THEN 1 ELSE 0 END)`,
        total: count(),
      })
        .from(attendance)
        .leftJoin(localUsers, eq(attendance.userId, localUsers.id))
        .where(
          sql`DATE_FORMAT(${attendance.date}, '%Y-%m') = ${input.month}`
        )
        .groupBy(attendance.userId, localUsers.fullName);

      return summary;
    }),

  allStaffStats: adminQuery
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM") }))
    .query(async ({ input }) => {
      const db = getDb();

      const statsResult = await db.select({
        present: sql<number>`SUM(CASE WHEN ${attendance.status} = 'present' THEN 1 ELSE 0 END)`,
        late: sql<number>`SUM(CASE WHEN ${attendance.status} = 'late' THEN 1 ELSE 0 END)`,
        absent: sql<number>`SUM(CASE WHEN ${attendance.status} = 'absent' THEN 1 ELSE 0 END)`,
        halfDay: sql<number>`SUM(CASE WHEN ${attendance.status} = 'half_day' THEN 1 ELSE 0 END)`,
      })
        .from(attendance)
        .where(
          sql`DATE_FORMAT(${attendance.date}, '%Y-%m') = ${input.month}`
        );

      return statsResult[0] || { present: 0, late: 0, absent: 0, halfDay: 0 };
    }),

  dailyStatus: adminQuery
    .query(async () => {
      const db = getDb();
      const today = getBhutanDateStr();

      const records = await db.select({
        status: attendance.status,
        count: count(),
      })
        .from(attendance)
        .where(eq(attendance.date, today))
        .groupBy(attendance.status);

      const totalStaff = await db.select({ count: count() }).from(localUsers).where(eq(localUsers.role, "staff"));

      return {
        breakdown: records,
        totalStaff: totalStaff[0]?.count || 0,
      };
    }),
});
