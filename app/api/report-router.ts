import { z } from "zod";
import { eq, and, gte, lte, desc, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery, staffQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  properties,
  propertyTypes,
  localUsers,
  attendance,
  payroll,
  propertyAgreements,
  propertyDocuments,
  finalLagthrams,
} from "@db/schema";
import { format } from "date-fns";

function generateCSV(data: Record<string, unknown>[], headers: string[]): string {
  const headerRow = headers.join(",");
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h];
      const str = val === null || val === undefined ? "" : String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r") ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(",")
  );
  return [headerRow, ...rows].join("\n");
}

function generateExcelCSV(data: Record<string, unknown>[], headers: string[]): string {
  return generateCSV(data, headers);
}

export const reportRouter = createRouter({
  exportProperties: adminQuery
    .input(
      z.object({
        status: z.enum(["draft", "submitted", "pending_review", "approved", "rejected", "completed", "cancelled"]).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        propertyTypeId: z.number().optional(),
        format: z.enum(["csv", "json"]).default("csv"),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];

      if (input?.status) conditions.push(eq(properties.approvalStatus, input.status));
      if (input?.propertyTypeId) conditions.push(eq(properties.propertyTypeId, input.propertyTypeId));
      if (input?.dateFrom) conditions.push(gte(properties.createdAt, new Date(input.dateFrom)));
      if (input?.dateTo) {
        const endOfDay = new Date(input.dateTo);
        endOfDay.setUTCHours(23, 59, 59, 999);
        conditions.push(lte(properties.createdAt, endOfDay));
      }

      const data = await db
        .select({
          id: properties.id,
          propertyName: properties.propertyName,
          propertyType: propertyTypes.name,
          address: properties.address,
          ownerName: properties.ownerName,
          ownerCID: properties.ownerCID,
          ownerPhone: properties.ownerPhone,
          sellingPrice: properties.sellingPrice,
          realEstateFee: properties.realEstateFee,
          currentStep: properties.currentStep,
          approvalStatus: properties.approvalStatus,
          workflowStatus: properties.workflowStatus,
          listedBy: localUsers.fullName,
          createdAt: properties.createdAt,
          completedAt: properties.completedAt,
        })
        .from(properties)
        .leftJoin(propertyTypes, eq(properties.propertyTypeId, propertyTypes.id))
        .leftJoin(localUsers, eq(properties.listedById, localUsers.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(properties.createdAt));

      const formattedData = data.map((row) => ({
        ...row,
        sellingPrice: String(row.sellingPrice),
        realEstateFee: String(row.realEstateFee),
        currentStep: String(row.currentStep),
        createdAt: row.createdAt ? format(row.createdAt, "yyyy-MM-dd HH:mm:ss") : "",
        completedAt: row.completedAt ? format(row.completedAt, "yyyy-MM-dd HH:mm:ss") : "",
      }));

      const headers = ["id", "propertyName", "propertyType", "address", "ownerName", "ownerCID", "ownerPhone", "sellingPrice", "realEstateFee", "currentStep", "approvalStatus", "workflowStatus", "listedBy", "createdAt", "completedAt"];

      if (input?.format === "json") {
        return { data: formattedData };
      }

      return { csv: generateCSV(formattedData, headers) };
    }),

  exportAttendance: adminQuery
    .input(
      z.object({
        userId: z.number().optional(),
        month: z.string().optional(),
        format: z.enum(["csv", "json"]).default("csv"),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];

      if (input?.userId) conditions.push(eq(attendance.userId, input.userId));
      if (input?.month) conditions.push(sql`DATE_FORMAT(${attendance.date}, '%Y-%m') = ${input.month}`);

      const data = await db
        .select({
          id: attendance.id,
          userName: localUsers.fullName,
          date: attendance.date,
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
          status: attendance.status,
          notes: attendance.notes,
        })
        .from(attendance)
        .leftJoin(localUsers, eq(attendance.userId, localUsers.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(attendance.date));

      const formattedData = data.map((row) => ({
        ...row,
        date: row.date ? format(row.date, "yyyy-MM-dd") : "",
        checkIn: row.checkIn ? format(row.checkIn, "HH:mm:ss") : "",
        checkOut: row.checkOut ? format(row.checkOut, "HH:mm:ss") : "",
      }));

      const headers = ["id", "userName", "date", "checkIn", "checkOut", "status", "notes"];

      if (input?.format === "json") {
        return { data: formattedData };
      }

      return { csv: generateCSV(formattedData, headers) };
    }),

  exportPayroll: adminQuery
    .input(
      z.object({
        userId: z.number().optional(),
        month: z.string().optional(),
        format: z.enum(["csv", "json"]).default("csv"),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];

      if (input?.userId) conditions.push(eq(payroll.userId, input.userId));
      if (input?.month) conditions.push(eq(payroll.month, input.month));

      const data = await db
        .select({
          id: payroll.id,
          userName: localUsers.fullName,
          month: payroll.month,
          baseSalary: payroll.baseSalary,
          bonus: payroll.bonus,
          deduction: payroll.deduction,
          netSalary: payroll.netSalary,
          paymentStatus: payroll.paymentStatus,
          paidAt: payroll.paidAt,
          notes: payroll.notes,
        })
        .from(payroll)
        .leftJoin(localUsers, eq(payroll.userId, localUsers.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(payroll.month));

      const formattedData = data.map((row) => ({
        ...row,
        baseSalary: String(row.baseSalary),
        bonus: String(row.bonus),
        deduction: String(row.deduction),
        netSalary: String(row.netSalary),
        paidAt: row.paidAt ? format(row.paidAt, "yyyy-MM-dd HH:mm:ss") : "",
      }));

      const headers = ["id", "userName", "month", "baseSalary", "bonus", "deduction", "netSalary", "paymentStatus", "paidAt", "notes"];

      if (input?.format === "json") {
        return { data: formattedData };
      }

      return { csv: generateCSV(formattedData, headers) };
    }),

  revenueReport: adminQuery
    .input(
      z.object({
        year: z.number().min(2000).max(2100).optional(),
        month: z.number().min(1).max(12).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const year = input?.year || new Date().getFullYear();
      const month = input?.month;

      let whereClause;
      if (month) {
        whereClause = and(
          sql`YEAR(${properties.completedAt}) = ${year}`,
          sql`MONTH(${properties.completedAt}) = ${month}`
        );
      } else {
        whereClause = sql`YEAR(${properties.completedAt}) = ${year}`;
      }

      const monthlyRevenue = await db
        .select({
          month: sql<number>`MONTH(${properties.completedAt})`,
          totalRevenue: sql<string>`COALESCE(SUM(${properties.realEstateFee}), 0)`,
          propertyCount: sql<number>`COUNT(*)`,
        })
        .from(properties)
        .where(and(eq(properties.workflowStatus, "completed"), whereClause))
        .groupBy(sql`MONTH(${properties.completedAt})`);

      const totalRevenueResult = await db
        .select({ total: sql<string>`COALESCE(SUM(${properties.realEstateFee}), 0)` })
        .from(properties)
        .where(and(eq(properties.workflowStatus, "completed"), whereClause));

      const propertyTypeRevenue = await db
        .select({
          typeName: propertyTypes.name,
          totalRevenue: sql<string>`COALESCE(SUM(${properties.realEstateFee}), 0)`,
          propertyCount: sql<number>`COUNT(*)`,
        })
        .from(properties)
        .leftJoin(propertyTypes, eq(properties.propertyTypeId, propertyTypes.id))
        .where(and(eq(properties.workflowStatus, "completed"), whereClause))
        .groupBy(propertyTypes.name);

      return {
        yearly: year,
        month: month || null,
        totalRevenue: totalRevenueResult[0]?.total || "0",
        monthlyRevenue: monthlyRevenue.map((r) => ({
          month: r.month,
          revenue: r.totalRevenue,
          count: r.propertyCount,
        })),
        byPropertyType: propertyTypeRevenue.map((r) => ({
          typeName: r.typeName || "Unknown",
          revenue: r.totalRevenue,
          count: r.propertyCount,
        })),
      };
    }),

  staffPerformance: adminQuery
    .query(async () => {
      const db = getDb();
      const conditions = [eq(localUsers.role, "staff")];

      const staffMembers = await db
        .select({
          id: localUsers.id,
          fullName: localUsers.fullName,
          email: localUsers.email,
        })
        .from(localUsers)
        .where(and(...conditions));

      const staffStats = await Promise.all(
        staffMembers.map(async (staff) => {
          const totalProps = await db
            .select({ count: count() })
            .from(properties)
            .where(and(eq(properties.listedById, staff.id)));

          const completedProps = await db
            .select({ count: count() })
            .from(properties)
            .where(and(eq(properties.listedById, staff.id), eq(properties.workflowStatus, "completed")));

          const pendingProps = await db
            .select({ count: count() })
            .from(properties)
            .where(and(eq(properties.listedById, staff.id), eq(properties.approvalStatus, "pending_review")));

          const rejectedProps = await db
            .select({ count: count() })
            .from(properties)
            .where(and(eq(properties.listedById, staff.id), eq(properties.approvalStatus, "rejected")));

          const revenueResult = await db
            .select({ total: sql<string>`COALESCE(SUM(${properties.realEstateFee}), 0)` })
            .from(properties)
            .where(and(eq(properties.listedById, staff.id), eq(properties.workflowStatus, "completed")));

          return {
            staffId: staff.id,
            staffName: staff.fullName,
            email: staff.email,
            totalProperties: totalProps[0]?.count || 0,
            completedProperties: completedProps[0]?.count || 0,
            pendingProperties: pendingProps[0]?.count || 0,
            rejectedProperties: rejectedProps[0]?.count || 0,
            totalRevenue: revenueResult[0]?.total || "0",
          };
        })
      );

      return staffStats;
    }),
});