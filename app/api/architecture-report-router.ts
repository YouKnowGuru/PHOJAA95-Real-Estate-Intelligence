import { z } from "zod";
import { eq, and, isNull, gte, lte, sql, desc } from "drizzle-orm";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  architectureProjects,
  architectureOrders,
  architecturePayments,
  architecturePaymentVerifications,
  architectureCategories,
  localUsers,
} from "@db/schema";

const reportTypeEnum = z.enum([
  "sales",
  "projects",
  "revenue",
  "staff_performance",
  "payment_collection",
  "outstanding_balances",
]);

const periodEnum = z.enum(["daily", "weekly", "monthly", "yearly", "custom"]);

function resolveDateRange(input: {
  period?: z.infer<typeof periodEnum>;
  dateFrom?: string;
  dateTo?: string;
}) {
  const now = new Date();
  let toDate = input.dateTo ? new Date(`${input.dateTo}T23:59:59`) : new Date(now);
  let fromDate: Date;

  if (input.dateFrom) {
    fromDate = new Date(`${input.dateFrom}T00:00:00`);
  } else if (input.period === "daily") {
    fromDate = new Date(now);
    fromDate.setHours(0, 0, 0, 0);
  } else if (input.period === "weekly") {
    fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    fromDate.setHours(0, 0, 0, 0);
  } else if (input.period === "yearly") {
    fromDate = new Date(now.getFullYear(), 0, 1);
  } else {
    fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  if (Number.isNaN(fromDate.getTime())) fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  if (Number.isNaN(toDate.getTime())) toDate = new Date(now);

  return { fromDate, toDate };
}

function orderDateFilter(fromDate: Date, toDate: Date) {
  return and(
    gte(architectureOrders.createdAt, fromDate),
    lte(architectureOrders.createdAt, toDate),
    isNull(architectureOrders.deletedAt)
  );
}

function projectDateFilter(fromDate: Date, toDate: Date) {
  return and(
    gte(architectureProjects.createdAt, fromDate),
    lte(architectureProjects.createdAt, toDate),
    isNull(architectureProjects.deletedAt)
  );
}

async function buildReportSummary(
  reportType: z.infer<typeof reportTypeEnum>,
  fromDate: Date,
  toDate: Date
) {
  const db = getDb();

  switch (reportType) {
    case "sales": {
      const [stats] = await db
        .select({
          totalOrders: sql<number>`COUNT(*)`,
          totalRevenue: sql<number>`COALESCE(SUM(${architectureOrders.finalAmount}), 0)`,
          collected: sql<number>`COALESCE(SUM(${architectureOrders.totalPaid}), 0)`,
          outstanding: sql<number>`COALESCE(SUM(${architectureOrders.remainingPayment}), 0)`,
          avgOrderValue: sql<number>`COALESCE(AVG(${architectureOrders.finalAmount}), 0)`,
        })
        .from(architectureOrders)
        .where(orderDateFilter(fromDate, toDate));

      const topOrders = await db
        .select({
          orderNumber: architectureOrders.orderNumber,
          projectName: architectureOrders.projectName,
          finalAmount: architectureOrders.finalAmount,
          totalPaid: architectureOrders.totalPaid,
          paymentStatus: architectureOrders.paymentStatus,
        })
        .from(architectureOrders)
        .where(orderDateFilter(fromDate, toDate))
        .orderBy(desc(architectureOrders.finalAmount))
        .limit(10);

      const ordersByPaymentStatus = await db
        .select({
          status: architectureOrders.paymentStatus,
          count: sql<number>`COUNT(*)`,
        })
        .from(architectureOrders)
        .where(orderDateFilter(fromDate, toDate))
        .groupBy(architectureOrders.paymentStatus);

      return {
        ...stats,
        topOrders,
        ordersByPaymentStatus,
      };
    }

    case "projects": {
      const projectsByStatus = await db
        .select({
          status: architectureProjects.status,
          count: sql<number>`COUNT(*)`,
        })
        .from(architectureProjects)
        .where(projectDateFilter(fromDate, toDate))
        .groupBy(architectureProjects.status);

      const [totals] = await db
        .select({ total: sql<number>`COUNT(*)` })
        .from(architectureProjects)
        .where(projectDateFilter(fromDate, toDate));

      return { totalProjects: totals?.total ?? 0, projectsByStatus };
    }

    case "revenue": {
      const [stats] = await db
        .select({
          totalRevenue: sql<number>`COALESCE(SUM(${architectureOrders.finalAmount}), 0)`,
          collectedRevenue: sql<number>`COALESCE(SUM(${architectureOrders.totalPaid}), 0)`,
          pendingRevenue: sql<number>`COALESCE(SUM(${architectureOrders.remainingPayment}), 0)`,
        })
        .from(architectureOrders)
        .where(orderDateFilter(fromDate, toDate));

      const revenueByMonth = await db
        .select({
          month: sql<string>`DATE_FORMAT(${architectureOrders.createdAt}, '%Y-%m')`,
          totalRevenue: sql<number>`COALESCE(SUM(${architectureOrders.finalAmount}), 0)`,
          collected: sql<number>`COALESCE(SUM(${architectureOrders.totalPaid}), 0)`,
          orderCount: sql<number>`COUNT(*)`,
        })
        .from(architectureOrders)
        .where(orderDateFilter(fromDate, toDate))
        .groupBy(sql`DATE_FORMAT(${architectureOrders.createdAt}, '%Y-%m')`)
        .orderBy(sql`DATE_FORMAT(${architectureOrders.createdAt}, '%Y-%m')`);

      return { ...stats, revenueByMonth };
    }

    case "staff_performance": {
      const staffRows = await db
        .select({
          staffId: architectureOrders.createdBy,
          staffName: localUsers.fullName,
          ordersCount: sql<number>`COUNT(*)`,
          revenue: sql<number>`COALESCE(SUM(${architectureOrders.finalAmount}), 0)`,
          collected: sql<number>`COALESCE(SUM(${architectureOrders.totalPaid}), 0)`,
        })
        .from(architectureOrders)
        .leftJoin(localUsers, eq(architectureOrders.createdBy, localUsers.id))
        .where(orderDateFilter(fromDate, toDate))
        .groupBy(architectureOrders.createdBy, localUsers.fullName)
        .orderBy(desc(sql`COALESCE(SUM(${architectureOrders.finalAmount}), 0)`));

      const projectCounts = await db
        .select({
          staffId: architectureProjects.createdBy,
          staffName: localUsers.fullName,
          projectCount: sql<number>`COUNT(*)`,
        })
        .from(architectureProjects)
        .leftJoin(localUsers, eq(architectureProjects.createdBy, localUsers.id))
        .where(projectDateFilter(fromDate, toDate))
        .groupBy(architectureProjects.createdBy, localUsers.fullName);

      return { staffPerformance: staffRows, projectCountsByStaff: projectCounts };
    }

    case "payment_collection": {
      const [paymentStats] = await db
        .select({
          totalPayments: sql<number>`COUNT(*)`,
          totalCollected: sql<number>`COALESCE(SUM(${architecturePayments.amount}), 0)`,
        })
        .from(architecturePayments)
        .where(and(gte(architecturePayments.paymentDate, fromDate), lte(architecturePayments.paymentDate, toDate)));

      const verificationStats = await db
        .select({
          status: architecturePaymentVerifications.status,
          count: sql<number>`COUNT(*)`,
        })
        .from(architecturePaymentVerifications)
        .innerJoin(architecturePayments, eq(architecturePaymentVerifications.paymentId, architecturePayments.id))
        .where(and(gte(architecturePayments.paymentDate, fromDate), lte(architecturePayments.paymentDate, toDate)))
        .groupBy(architecturePaymentVerifications.status);

      const paymentsByMethod = await db
        .select({
          method: architecturePayments.paymentMethod,
          count: sql<number>`COUNT(*)`,
          total: sql<number>`COALESCE(SUM(${architecturePayments.amount}), 0)`,
        })
        .from(architecturePayments)
        .where(and(gte(architecturePayments.paymentDate, fromDate), lte(architecturePayments.paymentDate, toDate)))
        .groupBy(architecturePayments.paymentMethod);

      return {
        ...paymentStats,
        verificationStats,
        paymentsByMethod,
      };
    }

    case "outstanding_balances": {
      const [stats] = await db
        .select({
          count: sql<number>`COUNT(*)`,
          totalOutstanding: sql<number>`COALESCE(SUM(${architectureOrders.remainingPayment}), 0)`,
          totalBilled: sql<number>`COALESCE(SUM(${architectureOrders.finalAmount}), 0)`,
          totalCollected: sql<number>`COALESCE(SUM(${architectureOrders.totalPaid}), 0)`,
        })
        .from(architectureOrders)
        .where(
          and(
            orderDateFilter(fromDate, toDate),
            sql`${architectureOrders.remainingPayment} > 0`
          )
        );

      const outstandingOrders = await db
        .select({
          orderNumber: architectureOrders.orderNumber,
          projectName: architectureOrders.projectName,
          finalAmount: architectureOrders.finalAmount,
          totalPaid: architectureOrders.totalPaid,
          remainingPayment: architectureOrders.remainingPayment,
          paymentStatus: architectureOrders.paymentStatus,
        })
        .from(architectureOrders)
        .where(
          and(
            orderDateFilter(fromDate, toDate),
            sql`${architectureOrders.remainingPayment} > 0`
          )
        )
        .orderBy(desc(architectureOrders.remainingPayment))
        .limit(15);

      return { ...stats, outstandingOrders };
    }

    default:
      return {};
  }
}

export const architectureReportRouter = createRouter({
  overview: adminQuery
    .input(z.object({ year: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const year = input?.year ? parseInt(input.year, 10) : new Date().getFullYear();
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31, 23, 59, 59);

      const totalStaff = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(localUsers)
        .where(and(eq(localUsers.role, "architecture_staff"), eq(localUsers.status, "active")));

      const pendingProjectApprovals = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(architectureProjects)
        .where(and(eq(architectureProjects.status, "submitted"), isNull(architectureProjects.deletedAt)));

      const pendingOrderApprovals = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(architectureOrders)
        .where(and(eq(architectureOrders.status, "pending_approval"), isNull(architectureOrders.deletedAt)));

      const [revenueStats] = await db
        .select({
          totalCollected: sql<number>`COALESCE(SUM(${architectureOrders.totalPaid}), 0)`,
          totalBilled: sql<number>`COALESCE(SUM(${architectureOrders.finalAmount}), 0)`,
          totalOutstanding: sql<number>`COALESCE(SUM(${architectureOrders.remainingPayment}), 0)`,
        })
        .from(architectureOrders)
        .where(isNull(architectureOrders.deletedAt));

      const [yearStats] = await db
        .select({
          ordersThisYear: sql<number>`COUNT(*)`,
          revenueThisYear: sql<number>`COALESCE(SUM(${architectureOrders.finalAmount}), 0)`,
        })
        .from(architectureOrders)
        .where(
          and(
            gte(architectureOrders.createdAt, yearStart),
            lte(architectureOrders.createdAt, yearEnd),
            isNull(architectureOrders.deletedAt)
          )
        );

      const projectsByStatus = await db
        .select({
          status: architectureProjects.status,
          count: sql<number>`COUNT(*)`,
        })
        .from(architectureProjects)
        .where(isNull(architectureProjects.deletedAt))
        .groupBy(architectureProjects.status);

      const ordersByPaymentStatus = await db
        .select({
          status: architectureOrders.paymentStatus,
          count: sql<number>`COUNT(*)`,
        })
        .from(architectureOrders)
        .where(isNull(architectureOrders.deletedAt))
        .groupBy(architectureOrders.paymentStatus);

      const monthlyTrend = await db
        .select({
          month: sql<string>`DATE_FORMAT(${architectureOrders.createdAt}, '%Y-%m')`,
          orderCount: sql<number>`COUNT(*)`,
          revenue: sql<number>`COALESCE(SUM(${architectureOrders.finalAmount}), 0)`,
          collected: sql<number>`COALESCE(SUM(${architectureOrders.totalPaid}), 0)`,
        })
        .from(architectureOrders)
        .where(
          and(
            gte(architectureOrders.createdAt, yearStart),
            lte(architectureOrders.createdAt, yearEnd),
            isNull(architectureOrders.deletedAt)
          )
        )
        .groupBy(sql`DATE_FORMAT(${architectureOrders.createdAt}, '%Y-%m')`)
        .orderBy(sql`DATE_FORMAT(${architectureOrders.createdAt}, '%Y-%m')`);

      const topCategories = await db
        .select({
          categoryName: architectureCategories.name,
          orderCount: sql<number>`COUNT(*)`,
          revenue: sql<number>`COALESCE(SUM(${architectureOrders.finalAmount}), 0)`,
        })
        .from(architectureOrders)
        .innerJoin(architectureCategories, eq(architectureOrders.categoryId, architectureCategories.id))
        .where(isNull(architectureOrders.deletedAt))
        .groupBy(architectureCategories.id, architectureCategories.name)
        .orderBy(desc(sql`COALESCE(SUM(${architectureOrders.finalAmount}), 0)`))
        .limit(6);

      return {
        year,
        kpis: {
          totalStaff: totalStaff[0]?.count ?? 0,
          pendingProjectApprovals: pendingProjectApprovals[0]?.count ?? 0,
          pendingOrderApprovals: pendingOrderApprovals[0]?.count ?? 0,
          totalCollected: Number(revenueStats?.totalCollected ?? 0),
          totalBilled: Number(revenueStats?.totalBilled ?? 0),
          totalOutstanding: Number(revenueStats?.totalOutstanding ?? 0),
          ordersThisYear: yearStats?.ordersThisYear ?? 0,
          revenueThisYear: Number(yearStats?.revenueThisYear ?? 0),
        },
        projectsByStatus,
        ordersByPaymentStatus,
        monthlyTrend,
        topCategories,
      };
    }),

  generate: adminQuery
    .input(
      z.object({
        reportName: z.string().min(1),
        reportType: reportTypeEnum,
        period: periodEnum.default("monthly"),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        exportFormat: z.enum(["pdf", "excel", "csv"]).default("pdf"),
      })
    )
    .mutation(async ({ input }) => {
      const { fromDate, toDate } = resolveDateRange(input);
      const summary = await buildReportSummary(input.reportType, fromDate, toDate);

      const dateFromStr = input.dateFrom ?? fromDate.toISOString().slice(0, 10);
      const dateToStr = input.dateTo ?? toDate.toISOString().slice(0, 10);

      return {
        id: Date.now(),
        reportName: input.reportName,
        reportType: input.reportType,
        period: input.period,
        dateFrom: dateFromStr,
        dateTo: dateToStr,
        exportFormat: input.exportFormat,
        summary,
        createdAt: new Date().toISOString(),
      };
    }),
});
