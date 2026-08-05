import { z } from "zod";
import { eq, and, desc, asc, sql, like, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery, staffQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { workProgressReports, localUsers } from "@db/schema";

// ─── Zod Schemas ───────────────────────────────────────────────────────
const scopeItemSchema = z.object({
  module: z.string().min(1, "Module name required"),
  description: z.string().min(1, "Description required"),
});

const timelineItemSchema = z.object({
  phase: z.string().min(1, "Phase name required"),
  targetCompletion: z.string().min(1, "Target date required"),
  status: z.enum(["completed", "pending", "in_progress"]).default("pending"),
});

const reportPayloadSchema = z.object({
  project: z.string().min(1, "Project name is required").max(255),
  feature: z.string().min(1, "Feature name is required").max(255),
  reportDate: z.string().min(1, "Report date is required"),
  featureOverview: z.string().optional().default(""),
  objectives: z.array(z.string()).default([]),
  scopeOfWork: z.array(scopeItemSchema).default([]),
  completedItems: z.array(z.string()).default([]),
  inProgressItems: z.array(z.string()).default([]),
  timeline: z.array(timelineItemSchema).default([]),
});

// ─── Report number generator ────────────────────────────────────────────
async function generateReportNumber(): Promise<string> {
  const db = getDb();
  const year = new Date().getFullYear();
  const result = await db
    .select({ maxId: sql<number>`MAX(id)` })
    .from(workProgressReports);
  const nextSeq = ((result[0]?.maxId ?? 0) + 1).toString().padStart(4, "0");
  return `WPR-${year}-${nextSeq}`;
}

// ─── Router ────────────────────────────────────────────────────────────
export const workProgressRouter = createRouter({
  /** Staff: create a draft report */
  create: staffQuery
    .input(reportPayloadSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const user = ctx.unifiedUser!;
      const reportNumber = await generateReportNumber();

      const [report] = await db
        .insert(workProgressReports)
        .values({
          reportNumber,
          staffId: user.id,
          staffName: user.name || user.email || "Unknown",
          project: input.project,
          feature: input.feature,
          reportDate: input.reportDate,
          status: "draft",
          featureOverview: input.featureOverview ?? "",
          objectives: input.objectives,
          scopeOfWork: input.scopeOfWork,
          completedItems: input.completedItems,
          inProgressItems: input.inProgressItems,
          timeline: input.timeline,
        })
        .$returningId();

      return { id: report.id, reportNumber };
    }),

  /** Staff: update own draft or submitted report */
  update: staffQuery
    .input(
      z.object({
        id: z.number(),
        ...reportPayloadSchema.shape,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const user = ctx.unifiedUser!;

      const existing = await db
        .select()
        .from(workProgressReports)
        .where(eq(workProgressReports.id, input.id))
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
      }

      // Staff can only edit their own reports; admin can edit any
      if (user.role !== "admin" && existing[0].staffId !== user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own reports" });
      }

      // Can only edit draft/submitted; reviewed/approved are locked
      if (user.role !== "admin" && (existing[0].status === "reviewed" || existing[0].status === "approved")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Report is under review and cannot be edited" });
      }

      await db
        .update(workProgressReports)
        .set({
          project: input.project,
          feature: input.feature,
          reportDate: input.reportDate,
          featureOverview: input.featureOverview ?? "",
          objectives: input.objectives,
          scopeOfWork: input.scopeOfWork,
          completedItems: input.completedItems,
          inProgressItems: input.inProgressItems,
          timeline: input.timeline,
        })
        .where(eq(workProgressReports.id, input.id));

      return { success: true };
    }),

  /** Staff: submit draft for admin review */
  submit: staffQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const user = ctx.unifiedUser!;

      const existing = await db
        .select()
        .from(workProgressReports)
        .where(eq(workProgressReports.id, input.id))
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
      }

      if (user.role !== "admin" && existing[0].staffId !== user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      if (existing[0].status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft reports can be submitted" });
      }

      await db
        .update(workProgressReports)
        .set({ status: "submitted" })
        .where(eq(workProgressReports.id, input.id));

      return { success: true };
    }),

  /** Staff: get own reports */
  getMyReports: staffQuery
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
        status: z.enum(["all", "draft", "submitted", "reviewed", "approved"]).default("all"),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const user = ctx.unifiedUser!;
      const offset = (input.page - 1) * input.limit;

      const conditions = [eq(workProgressReports.staffId, user.id)];
      if (input.status !== "all") {
        conditions.push(eq(workProgressReports.status, input.status));
      }
      if (input.search?.trim()) {
        const s = `%${input.search.trim()}%`;
        conditions.push(
          or(
            like(workProgressReports.project, s),
            like(workProgressReports.feature, s),
            like(workProgressReports.reportNumber, s)
          )!
        );
      }

      const [reports, total] = await Promise.all([
        db
          .select()
          .from(workProgressReports)
          .where(and(...conditions))
          .orderBy(desc(workProgressReports.createdAt))
          .limit(input.limit)
          .offset(offset),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(workProgressReports)
          .where(and(...conditions)),
      ]);

      return {
        reports,
        total: Number(total[0]?.count ?? 0),
        page: input.page,
        totalPages: Math.ceil(Number(total[0]?.count ?? 0) / input.limit),
      };
    }),

  /** Staff/Admin: get a single report by id */
  getById: staffQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const user = ctx.unifiedUser!;

      const [report] = await db
        .select()
        .from(workProgressReports)
        .where(eq(workProgressReports.id, input.id))
        .limit(1);

      if (!report) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
      }

      // Staff can only view their own; admin can view any
      if (user.role !== "admin" && report.staffId !== user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      return report;
    }),

  /** Admin: list all reports */
  listAll: adminQuery
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        status: z.enum(["all", "draft", "submitted", "reviewed", "approved"]).default("all"),
        search: z.string().optional(),
        staffId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const offset = (input.page - 1) * input.limit;

      const conditions: ReturnType<typeof eq>[] = [];
      if (input.status !== "all") {
        conditions.push(eq(workProgressReports.status, input.status) as any);
      }
      if (input.staffId) {
        conditions.push(eq(workProgressReports.staffId, input.staffId) as any);
      }
      if (input.search?.trim()) {
        const s = `%${input.search.trim()}%`;
        conditions.push(
          or(
            like(workProgressReports.project, s),
            like(workProgressReports.feature, s),
            like(workProgressReports.staffName, s),
            like(workProgressReports.reportNumber, s)
          ) as any
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [reports, total] = await Promise.all([
        db
          .select()
          .from(workProgressReports)
          .where(whereClause)
          .orderBy(desc(workProgressReports.createdAt))
          .limit(input.limit)
          .offset(offset),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(workProgressReports)
          .where(whereClause),
      ]);

      return {
        reports,
        total: Number(total[0]?.count ?? 0),
        page: input.page,
        totalPages: Math.ceil(Number(total[0]?.count ?? 0) / input.limit),
      };
    }),

  /** Admin: review a report — add notes and change status */
  review: adminQuery
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["reviewed", "approved", "submitted"]),
        adminNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const admin = ctx.unifiedUser!;

      const [existing] = await db
        .select()
        .from(workProgressReports)
        .where(eq(workProgressReports.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
      }

      await db
        .update(workProgressReports)
        .set({
          status: input.status,
          adminNotes: input.adminNotes ?? existing.adminNotes,
          reviewedBy: admin.id,
          reviewedByName: admin.name || admin.email || "Admin",
          reviewedAt: new Date(),
        })
        .where(eq(workProgressReports.id, input.id));

      return { success: true };
    }),

  /** Staff: delete own draft report */
  delete: staffQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const user = ctx.unifiedUser!;

      const [existing] = await db
        .select()
        .from(workProgressReports)
        .where(eq(workProgressReports.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
      }

      if (user.role !== "admin" && existing.staffId !== user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete your own reports" });
      }

      if (user.role !== "admin" && existing.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft reports can be deleted" });
      }

      await db
        .delete(workProgressReports)
        .where(eq(workProgressReports.id, input.id));

      return { success: true };
    }),

  /** Admin: get staff list for filter dropdown */
  getStaffList: adminQuery.query(async () => {
    const db = getDb();
    const staff = await db
      .select({
        id: localUsers.id,
        name: localUsers.fullName,
        role: localUsers.role,
      })
      .from(localUsers)
      .where(eq(localUsers.status, "active"))
      .orderBy(asc(localUsers.fullName));
    return staff;
  }),
});
