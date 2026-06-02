import { z } from "zod";
import { eq, and, isNull, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, developerQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { softwareSales, softwarePayments, softwareProjects, softwareCustomers, softwareProducts } from "@db/schema";
import { isDeveloperRole, softwareCustomerVisibleToDeveloper, softwareProjectVisibleToDeveloper } from "./lib/access-control";

export const softwareReportRouter = createRouter({
  list: developerQuery
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
    }).optional())
    .query(async () => {
      return { items: [], total: 0, page: 1, limit: 50 };
    }),

  generate: developerQuery
    .input(z.object({
      reportName: z.string().min(1),
      reportType: z.enum([
        "sales_summary",
        "project_progress",
        "payment_collection",
        "customer_analysis",
        "product_performance",
        "revenue_report",
        "outstanding_payments",
        "developer_performance",
      ]),
      dateFrom: z.string(),
      dateTo: z.string(),
      exportFormat: z.enum(["pdf", "excel", "csv"]).default("pdf"),
      filters: z.record(z.string(), z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const fromDate = new Date(`${input.dateFrom}T00:00:00`);
      const toDate = new Date(`${input.dateTo}T23:59:59`);
      const devScope = isDeveloperRole(ctx.unifiedUser!.role)
        ? eq(softwareSales.createdBy, ctx.unifiedUser!.id)
        : undefined;
      const projectDevScope = isDeveloperRole(ctx.unifiedUser!.role)
        ? softwareProjectVisibleToDeveloper(ctx.unifiedUser!.id)
        : undefined;
      const customerDevScope = isDeveloperRole(ctx.unifiedUser!.role)
        ? softwareCustomerVisibleToDeveloper(ctx.unifiedUser!.id)
        : undefined;

      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid date range" });
      }
      if (fromDate > toDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Start date must be before end date" });
      }

      let summary: Record<string, unknown> = {};

      switch (input.reportType) {
        case "sales_summary": {
          const [saleStats] = await db
            .select({
              totalSales: sql<number>`COUNT(*)`,
              totalRevenue: sql<number>`COALESCE(SUM(grand_total), 0)`,
              avgSale: sql<number>`COALESCE(AVG(grand_total), 0)`,
            })
            .from(softwareSales)
            .where(
              and(
                gte(softwareSales.createdAt, fromDate),
                lte(softwareSales.createdAt, toDate),
                isNull(softwareSales.deletedAt),
                devScope
              )
            );
          summary = saleStats;
          break;
        }
        case "project_progress": {
          const projectStats = await db
            .select({
              status: softwareProjects.status,
              count: sql<number>`COUNT(*)`,
            })
            .from(softwareProjects)
            .where(
              and(
                gte(softwareProjects.createdAt, fromDate),
                lte(softwareProjects.createdAt, toDate),
                isNull(softwareProjects.deletedAt),
                projectDevScope
              )
            )
            .groupBy(softwareProjects.status);
          summary = { projectsByStatus: projectStats };
          break;
        }
        case "payment_collection": {
          const paymentQuery = db
            .select({
              totalPayments: sql<number>`COUNT(*)`,
              totalCollected: sql<number>`COALESCE(SUM(${softwarePayments.amount}), 0)`,
            })
            .from(softwarePayments)
            .innerJoin(softwareSales, eq(softwarePayments.saleId, softwareSales.id))
            .where(
              and(
                gte(softwarePayments.paymentDate, fromDate),
                lte(softwarePayments.paymentDate, toDate),
                devScope
              )
            );
          const [paymentStats] = await paymentQuery;
          summary = paymentStats;
          break;
        }
        case "customer_analysis": {
          const [customerStats] = await db
            .select({
              totalCustomers: sql<number>`COUNT(*)`,
            })
            .from(softwareCustomers)
            .where(
              and(
                gte(softwareCustomers.createdAt, fromDate),
                lte(softwareCustomers.createdAt, toDate),
                isNull(softwareCustomers.deletedAt),
                customerDevScope
              )
            );
          summary = customerStats;
          break;
        }
        case "revenue_report": {
          // Revenue by month from sales
          const revenueData = await db
            .select({
              month: sql<string>`DATE_FORMAT(${softwareSales.createdAt}, '%Y-%m')`,
              totalRevenue: sql<number>`COALESCE(SUM(grand_total), 0)`,
              saleCount: sql<number>`COUNT(*)`,
            })
            .from(softwareSales)
            .where(
              and(
                gte(softwareSales.createdAt, fromDate),
                lte(softwareSales.createdAt, toDate),
                isNull(softwareSales.deletedAt),
                devScope
              )
            )
            .groupBy(sql`DATE_FORMAT(${softwareSales.createdAt}, '%Y-%m')`)
            .orderBy(sql`DATE_FORMAT(${softwareSales.createdAt}, '%Y-%m')`);
          summary = { revenueByMonth: revenueData };
          break;
        }
        case "product_performance": {
          // Product sales performance
          const perfData = await db
            .select({
              productId: softwareSales.productId,
              saleCount: sql<number>`COUNT(*)`,
              totalRevenue: sql<number>`COALESCE(SUM(grand_total), 0)`,
            })
            .from(softwareSales)
            .where(
              and(
                gte(softwareSales.createdAt, fromDate),
                lte(softwareSales.createdAt, toDate),
                isNull(softwareSales.deletedAt),
                devScope
              )
            )
            .groupBy(softwareSales.productId);

          const productConditions = [isNull(softwareProducts.deletedAt)];
          if (isDeveloperRole(ctx.unifiedUser!.role)) {
            productConditions.push(eq(softwareProducts.createdBy, ctx.unifiedUser!.id));
          }

          const products = await db
            .select({
              id: softwareProducts.id,
              name: softwareProducts.name,
              category: softwareProducts.category,
            })
            .from(softwareProducts)
            .where(and(...productConditions));

          const productMap = new Map(products.map(p => [p.id, p]));
          summary = {
            productPerformance: perfData.map((p: any) => ({
              ...p,
              productName: productMap.get(p.productId)?.name || "Unknown",
              category: productMap.get(p.productId)?.category || "unknown",
            })),
          };
          break;
        }
        case "outstanding_payments": {
          const [outstanding] = await db
            .select({
              totalOutstanding: sql<number>`COALESCE(SUM(outstanding_balance), 0)`,
              count: sql<number>`COUNT(*)`,
            })
            .from(softwareSales)
            .where(
              and(
                gte(softwareSales.createdAt, fromDate),
                lte(softwareSales.createdAt, toDate),
                isNull(softwareSales.deletedAt),
                sql`${softwareSales.outstandingBalance} > 0`,
                devScope
              )
            );
          summary = outstanding;
          break;
        }
        case "developer_performance": {
          const devPerfConditions = [
            gte(softwareProjects.createdAt, fromDate),
            lte(softwareProjects.createdAt, toDate),
            isNull(softwareProjects.deletedAt),
            projectDevScope,
          ];
          const devStats = await db
            .select({
              developerId: softwareProjects.assignedDeveloperId,
              count: sql<number>`COUNT(*)`,
            })
            .from(softwareProjects)
            .where(and(...devPerfConditions))
            .groupBy(softwareProjects.assignedDeveloperId);
          summary = { developerProjects: devStats };
          break;
        }
      }

      return {
        id: Date.now(),
        reportName: input.reportName,
        reportType: input.reportType,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        exportFormat: input.exportFormat,
        filters: input.filters ?? {},
        summary,
        createdAt: new Date().toISOString(),
      };
    }),

  stats: developerQuery.query(async () => {
    return { total: 0, pdf: 0, excel: 0, csv: 0 };
  }),
});
