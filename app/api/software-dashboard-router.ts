import { eq, count, and, isNull, sql, inArray } from "drizzle-orm";
import { createRouter, developerQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  softwareProducts,
  softwareProjects,
  softwareSales,
  softwareInvoices,
  softwareCertificates,
  localUsers,
} from "@db/schema";
import {
  isDeveloperRole,
  SOFTWARE_REVENUE_SALE_STATUSES,
  softwareProjectVisibleToDeveloper,
} from "./lib/access-control";

function developerProductScope(userId: number, role: string) {
  return isDeveloperRole(role) ? eq(softwareProducts.createdBy, userId) : undefined;
}

function developerProjectScope(userId: number, role: string) {
  return isDeveloperRole(role) ? softwareProjectVisibleToDeveloper(userId) : undefined;
}

function developerSaleScope(userId: number, role: string) {
  return isDeveloperRole(role) ? eq(softwareSales.createdBy, userId) : undefined;
}

function mergeScope(...scopes: Array<ReturnType<typeof eq> | undefined>) {
  const active = scopes.filter(Boolean);
  return active.length > 0 ? and(...active) : undefined;
}

export const softwareDashboardRouter = createRouter({
  developer: developerQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.unifiedUser!.id;
    const role = ctx.unifiedUser!.role;

    const productScope = developerProductScope(userId, role);
    const projectScope = developerProjectScope(userId, role);
    const saleScope = developerSaleScope(userId, role);
    const revenueStatus = inArray(softwareSales.status, [...SOFTWARE_REVENUE_SALE_STATUSES]);

    const totalProducts = await db
      .select({ count: count() })
      .from(softwareProducts)
      .where(mergeScope(isNull(softwareProducts.deletedAt), productScope));

    const activeProjects = await db
      .select({ count: count() })
      .from(softwareProjects)
      .where(
        mergeScope(
          eq(softwareProjects.status, "in_progress"),
          isNull(softwareProjects.deletedAt),
          projectScope
        )
      );

    const pendingProjects = await db
      .select({ count: count() })
      .from(softwareProjects)
      .where(
        mergeScope(
          eq(softwareProjects.status, "pending_approval"),
          isNull(softwareProjects.deletedAt),
          projectScope
        )
      );

    const completedProjects = await db
      .select({ count: count() })
      .from(softwareProjects)
      .where(
        mergeScope(
          eq(softwareProjects.status, "completed"),
          isNull(softwareProjects.deletedAt),
          projectScope
        )
      );

    const pendingSales = await db
      .select({ count: count() })
      .from(softwareSales)
      .where(
        mergeScope(
          eq(softwareSales.status, "pending_approval"),
          isNull(softwareSales.deletedAt),
          saleScope
        )
      );

    const approvedSales = await db
      .select({ count: count() })
      .from(softwareSales)
      .where(
        mergeScope(
          eq(softwareSales.status, "approved"),
          isNull(softwareSales.deletedAt),
          saleScope
        )
      );

    const totalRevenue = await db
      .select({ total: sql`SUM(${softwareSales.grandTotal})` })
      .from(softwareSales)
      .where(mergeScope(revenueStatus, isNull(softwareSales.deletedAt), saleScope));

    const outstandingPayments = await db
      .select({ total: sql`SUM(${softwareSales.outstandingBalance})` })
      .from(softwareSales)
      .where(
        mergeScope(
          sql`${softwareSales.outstandingBalance} > 0`,
          isNull(softwareSales.deletedAt),
          saleScope
        )
      );

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlySales = await db
      .select({
        month: sql<string>`DATE_FORMAT(${softwareSales.createdAt}, '%Y-%m')`,
        total: sql<string>`SUM(${softwareSales.grandTotal})`,
        count: count(),
      })
      .from(softwareSales)
      .where(
        mergeScope(
          sql`${softwareSales.createdAt} >= ${sixMonthsAgo}`,
          revenueStatus,
          isNull(softwareSales.deletedAt),
          saleScope
        )
      )
      .groupBy(sql`DATE_FORMAT(${softwareSales.createdAt}, '%Y-%m')`)
      .orderBy(sql`DATE_FORMAT(${softwareSales.createdAt}, '%Y-%m')`);

    const projectStatus = await db
      .select({
        status: softwareProjects.status,
        count: count(),
      })
      .from(softwareProjects)
      .where(mergeScope(isNull(softwareProjects.deletedAt), projectScope))
      .groupBy(softwareProjects.status);

    const paymentStatus = await db
      .select({
        status: softwareSales.paymentStatus,
        count: count(),
      })
      .from(softwareSales)
      .where(mergeScope(isNull(softwareSales.deletedAt), saleScope))
      .groupBy(softwareSales.paymentStatus);

    return {
      totalProducts: totalProducts[0]?.count || 0,
      activeProjects: activeProjects[0]?.count || 0,
      pendingProjects: pendingProjects[0]?.count || 0,
      completedProjects: completedProjects[0]?.count || 0,
      pendingSales: pendingSales[0]?.count || 0,
      approvedSales: approvedSales[0]?.count || 0,
      totalRevenue: Number(totalRevenue[0]?.total || 0),
      outstandingPayments: Number(outstandingPayments[0]?.total || 0),
      monthlySales,
      projectStatus,
      paymentStatus,
    };
  }),

  admin: adminQuery.query(async () => {
    const db = getDb();
    const revenueStatus = inArray(softwareSales.status, [...SOFTWARE_REVENUE_SALE_STATUSES]);

    const totalDevelopers = await db
      .select({ count: count() })
      .from(localUsers)
      .where(eq(localUsers.role, "developer"));

    const pendingProductApprovals = await db
      .select({ count: count() })
      .from(softwareProducts)
      .where(and(eq(softwareProducts.status, "pending_approval"), isNull(softwareProducts.deletedAt)));

    const pendingProjectApprovals = await db
      .select({ count: count() })
      .from(softwareProjects)
      .where(and(eq(softwareProjects.status, "pending_approval"), isNull(softwareProjects.deletedAt)));

    const pendingSalesApprovals = await db
      .select({ count: count() })
      .from(softwareSales)
      .where(and(eq(softwareSales.status, "pending_approval"), isNull(softwareSales.deletedAt)));

    const activeProjects = await db
      .select({ count: count() })
      .from(softwareProjects)
      .where(and(eq(softwareProjects.status, "in_progress"), isNull(softwareProjects.deletedAt)));

    const totalRevenue = await db
      .select({ total: sql`SUM(${softwareSales.grandTotal})` })
      .from(softwareSales)
      .where(and(revenueStatus, isNull(softwareSales.deletedAt)));

    const totalInvoices = await db
      .select({ count: count() })
      .from(softwareInvoices)
      .where(isNull(softwareInvoices.deletedAt));

    const totalCertificates = await db
      .select({ count: count() })
      .from(softwareCertificates);

    return {
      totalDevelopers: totalDevelopers[0]?.count || 0,
      pendingProductApprovals: pendingProductApprovals[0]?.count || 0,
      pendingProjectApprovals: pendingProjectApprovals[0]?.count || 0,
      pendingSalesApprovals: pendingSalesApprovals[0]?.count || 0,
      activeProjects: activeProjects[0]?.count || 0,
      totalRevenue: Number(totalRevenue[0]?.total || 0),
      totalInvoices: totalInvoices[0]?.count || 0,
      totalCertificates: totalCertificates[0]?.count || 0,
    };
  }),

  developerList: developerQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        id: localUsers.id,
        fullName: localUsers.fullName,
        email: localUsers.email,
      })
      .from(localUsers)
      .where(and(eq(localUsers.role, "developer"), eq(localUsers.status, "active")));
  }),
});
