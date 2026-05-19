import { z } from "zod";
import { eq, count, sql, desc, and, gte } from "drizzle-orm";
import { createRouter, adminQuery, staffQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  properties,
  localUsers,
  attendance,
  payroll,
  propertyTypes,
  approvalHistory,
} from "@db/schema";

export const dashboardRouter = createRouter({
  // ─── ADMIN ANALYTICS ─────────────────────────────────────────────
  adminStats: adminQuery.query(async () => {
    const db = getDb();

    const totalProperties = await db.select({ count: count() }).from(properties);
    const totalStaff = await db.select({ count: count() }).from(localUsers).where(eq(localUsers.role, "staff"));
    const pendingApprovals = await db.select({ count: count() }).from(properties).where(eq(properties.approvalStatus, "pending_review"));
    const completedSales = await db.select({ count: count() }).from(properties).where(eq(properties.workflowStatus, "completed"));
    const rejectedCount = await db.select({ count: count() }).from(properties).where(eq(properties.approvalStatus, "rejected"));
    const totalRevenue = await db.select({ total: sql<string>`COALESCE(SUM(${properties.realEstateFee}), 0)` }).from(properties).where(eq(properties.workflowStatus, "completed"));

    return {
      totalProperties: totalProperties[0]?.count || 0,
      totalStaff: totalStaff[0]?.count || 0,
      pendingApprovals: pendingApprovals[0]?.count || 0,
      completedSales: completedSales[0]?.count || 0,
      rejectedCount: rejectedCount[0]?.count || 0,
      totalRevenue: totalRevenue[0]?.total || "0",
    };
  }),

  monthlySales: adminQuery
    .input(z.object({ year: z.string().regex(/^\d{4}$/).default(new Date().getFullYear().toString()) }))
    .query(async ({ input }) => {
      const db = getDb();

      const startOfYear = new Date(`${input.year}-01-01`);

      const results = await db
        .select({
          month: sql<string>`DATE_FORMAT(${properties.completedAt}, '%Y-%m')`,
          count: count(),
          revenue: sql<string>`COALESCE(SUM(${properties.realEstateFee}), 0)`,
        })
        .from(properties)
        .where(
          and(
            eq(properties.workflowStatus, "completed"),
            gte(properties.completedAt, startOfYear)
          )
        )
        .groupBy(sql`DATE_FORMAT(${properties.completedAt}, '%Y-%m')`)
        .orderBy(sql`DATE_FORMAT(${properties.completedAt}, '%Y-%m')`);

      return results;
    }),

  propertyTypeStats: adminQuery.query(async () => {
    const db = getDb();

    const results = await db
      .select({
        typeName: propertyTypes.name,
        count: count(),
        totalRevenue: sql<string>`COALESCE(SUM(${properties.realEstateFee}), 0)`,
      })
      .from(properties)
      .leftJoin(propertyTypes, eq(properties.propertyTypeId, propertyTypes.id))
      .where(eq(properties.workflowStatus, "completed"))
      .groupBy(properties.propertyTypeId, propertyTypes.name)
      .orderBy(desc(count()));

    return results;
  }),

  staffPerformance: adminQuery
    .query(async () => {
      const db = getDb();

      const results = await db
        .select({
          staffId: properties.listedById,
          staffName: localUsers.fullName,
          totalProperties: count(),
          completedSales: sql<number>`SUM(CASE WHEN ${properties.workflowStatus} = 'completed' THEN 1 ELSE 0 END)`,
          pendingApprovals: sql<number>`SUM(CASE WHEN ${properties.approvalStatus} = 'pending_review' THEN 1 ELSE 0 END)`,
          totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${properties.workflowStatus} = 'completed' THEN ${properties.realEstateFee} ELSE 0 END), 0)`,
        })
        .from(properties)
        .leftJoin(localUsers, eq(properties.listedById, localUsers.id))
        .groupBy(properties.listedById, localUsers.fullName)
        .orderBy(desc(count()));

      return results;
    }),

  recentActivity: adminQuery
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ input }) => {
      const db = getDb();

      const results = await db
        .select({
          id: approvalHistory.id,
          propertyId: approvalHistory.propertyId,
          step: approvalHistory.step,
          action: approvalHistory.action,
          comments: approvalHistory.comments,
          createdAt: approvalHistory.createdAt,
          propertyName: properties.propertyName,
          adminName: localUsers.fullName,
        })
        .from(approvalHistory)
        .leftJoin(properties, eq(approvalHistory.propertyId, properties.id))
        .leftJoin(localUsers, eq(approvalHistory.adminId, localUsers.id))
        .orderBy(desc(approvalHistory.createdAt))
        .limit(input.limit);

      return results;
    }),

  workflowStats: adminQuery.query(async () => {
    const db = getDb();

    const stepStats = await db
      .select({
        step: properties.currentStep,
        count: count(),
        approved: sql<number>`SUM(CASE WHEN ${properties.approvalStatus} = 'approved' THEN 1 ELSE 0 END)`,
        pending: sql<number>`SUM(CASE WHEN ${properties.approvalStatus} = 'pending_review' THEN 1 ELSE 0 END)`,
        rejected: sql<number>`SUM(CASE WHEN ${properties.approvalStatus} = 'rejected' THEN 1 ELSE 0 END)`,
      })
      .from(properties)
      .groupBy(properties.currentStep);

    return stepStats;
  }),

  // ─── STAFF ANALYTICS ─────────────────────────────────────────────
  staffStats: adminQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      const totalProperties = await db.select({ count: count() })
        .from(properties)
        .where(eq(properties.listedById, input.userId));
      const completed = await db.select({ count: count() })
        .from(properties)
        .where(and(eq(properties.listedById, input.userId), eq(properties.workflowStatus, "completed")));
      const pending = await db.select({ count: count() })
        .from(properties)
        .where(and(eq(properties.listedById, input.userId), eq(properties.approvalStatus, "pending_review")));
      const rejected = await db.select({ count: count() })
        .from(properties)
        .where(and(eq(properties.listedById, input.userId), eq(properties.approvalStatus, "rejected")));

      return {
        totalProperties: totalProperties[0]?.count || 0,
        completedSales: completed[0]?.count || 0,
        pendingApprovals: pending[0]?.count || 0,
        rejectedCount: rejected[0]?.count || 0,
      };
    }),

  staffRecentActivity: staffQuery
    .input(z.object({ limit: z.number().default(5) }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;

      const results = await db
        .select({
          id: properties.id,
          propertyName: properties.propertyName,
          status: properties.approvalStatus,
          step: properties.currentStep,
          updatedAt: properties.updatedAt,
        })
        .from(properties)
        .where(eq(properties.listedById, userId))
        .orderBy(desc(properties.updatedAt))
        .limit(input.limit);

      return results;
    }),
});
