import { z } from "zod";
import { eq, and, desc, asc, sql, like, or, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery, staffQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { workProgressReports, localUsers, notifications, activityLogs } from "@db/schema";

// ─── Zod Schemas ───────────────────────────────────────────────────────
const scopeItemSchema = z.object({
  module: z.string().min(1, "Module name required"),
  description: z.string().min(1, "Description required"),
});

const timelineItemSchema = z.object({
  phase: z.string().min(1, "Phase name required"),
  targetCompletion: z.string().optional().default(""),
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

// ─── Notification helpers (never throw — must not break business logic) ─
type NotificationType = "info" | "success" | "warning" | "error" | "approval";

async function createWorkProgressNotification({
  userId,
  title,
  message,
  type,
  entityId,
}: {
  userId: number;
  title: string;
  message: string;
  type: NotificationType;
  entityId?: number;
}) {
  try {
    const db = getDb();
    await db.insert(notifications).values({
      userId,
      title,
      message,
      type,
      entityType: "work_progress_report",
      entityId,
    });
  } catch {
    // Notifications should never break business logic
  }
}

async function getActiveAdminIds(): Promise<number[]> {
  const db = getDb();
  const admins = await db
    .select({ id: localUsers.id })
    .from(localUsers)
    .where(and(eq(localUsers.role, "admin"), eq(localUsers.status, "active")));
  return admins.map((a) => a.id);
}

// ─── Audit logging (silent fail — must not break business logic) ──────────
async function logWorkProgressActivity({
  userId,
  userName,
  action,
  entityId,
  metadata,
}: {
  userId?: number;
  userName?: string;
  action: string;
  entityId?: number;
  metadata?: Record<string, unknown>;
}) {
  try {
    const db = getDb();
    await db.insert(activityLogs).values({
      userId,
      userName,
      action,
      entityType: "work_progress_report",
      entityId,
      metadata,
    });
  } catch {
    // Audit logging should never break business logic
  }
}

// ─── Report number generator (with retry on unique-collision) ────────────
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

      // Retry up to 3 times in case of unique-key collision on report_number
      let report: { id: number } | null = null;
      let reportNumber = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        reportNumber = await generateReportNumber();
        try {
          const [r] = await db
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
          report = r;
          break;
        } catch (err: any) {
          // If it's a duplicate-key error and we have attempts left, retry
          const isDup = err?.code === "ER_DUP_ENTRY" || /duplicate/i.test(String(err?.message ?? ""));
          if (!isDup || attempt === 2) throw err;
        }
      }

      await logWorkProgressActivity({
        userId: user.id,
        userName: user.name || user.email,
        action: "WORK_PROGRESS_CREATED",
        entityId: report!.id,
        metadata: { reportNumber, project: input.project, feature: input.feature },
      });

      return { id: report!.id, reportNumber };
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

      await logWorkProgressActivity({
        userId: user.id,
        userName: user.name || user.email,
        action: "WORK_PROGRESS_UPDATED",
        entityId: input.id,
        metadata: { reportNumber: existing[0].reportNumber, project: input.project, feature: input.feature },
      });

      return { success: true };
    }),

  /** Staff: submit draft (or re-submit a sent-back report) for admin review */
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

      // Allow submit from "draft" OR "submitted" (so a sent-back report can be re-submitted)
      if (existing[0].status !== "draft" && existing[0].status !== "submitted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft or sent-back reports can be submitted",
        });
      }

      await db
        .update(workProgressReports)
        .set({ status: "submitted" })
        .where(eq(workProgressReports.id, input.id));

      // Notify all active admins that a report is pending review
      const adminIds = await getActiveAdminIds();
      await Promise.all(
        adminIds.map((adminId) =>
          createWorkProgressNotification({
            userId: adminId,
            title: "Work Progress Report Submitted for Review",
            message: `${existing[0].staffName} submitted report ${existing[0].reportNumber} (${existing[0].project} — ${existing[0].feature}) for your review.`,
            type: "approval",
            entityId: input.id,
          })
        )
      );

      await logWorkProgressActivity({
        userId: user.id,
        userName: user.name || user.email,
        action: "WORK_PROGRESS_SUBMITTED",
        entityId: input.id,
        metadata: { reportNumber: existing[0].reportNumber, project: existing[0].project, feature: existing[0].feature },
      });

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
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
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
      // FEATURE: date-range filter on report_date (YYYY-MM-DD string comparison)
      if (input.dateFrom) {
        conditions.push(gte(workProgressReports.reportDate, input.dateFrom) as any);
      }
      if (input.dateTo) {
        conditions.push(lte(workProgressReports.reportDate, input.dateTo) as any);
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
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
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
      // FEATURE: date-range filter on report_date (YYYY-MM-DD string comparison)
      if (input.dateFrom) {
        conditions.push(gte(workProgressReports.reportDate, input.dateFrom) as any);
      }
      if (input.dateTo) {
        conditions.push(lte(workProgressReports.reportDate, input.dateTo) as any);
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

  /** Admin: export ALL matching reports (no pagination cap) for CSV/Excel download */
  exportList: adminQuery
    .input(
      z.object({
        status: z.enum(["all", "draft", "submitted", "reviewed", "approved"]).default("all"),
        search: z.string().optional(),
        staffId: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();

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
      if (input.dateFrom) {
        conditions.push(gte(workProgressReports.reportDate, input.dateFrom) as any);
      }
      if (input.dateTo) {
        conditions.push(lte(workProgressReports.reportDate, input.dateTo) as any);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const reports = await db
        .select()
        .from(workProgressReports)
        .where(whereClause)
        .orderBy(desc(workProgressReports.createdAt))
        .limit(1000); // safety cap

      return { reports };
    }),

  /** Admin: review a report — add notes and change status */
  review: adminQuery
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["reviewed", "approved", "draft"]),
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

      // Admins can only act on submitted or reviewed reports — not drafts
      if (existing.status === "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot review a report that has not been submitted",
        });
      }
      // "approved" is a terminal state — cannot send back or re-review
      if (existing.status === "approved" && input.status !== "approved") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Approved reports cannot be changed",
        });
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

      // Notify the staff member about the review outcome
      const statusVerb =
        input.status === "approved" ? "approved"
        : input.status === "reviewed" ? "reviewed"
        : "sent back for revision";
      await createWorkProgressNotification({
        userId: existing.staffId,
        title:
          input.status === "approved"
            ? "Work Progress Report Approved ✅"
            : input.status === "reviewed"
            ? "Work Progress Report Reviewed"
            : "Work Progress Report Sent Back",
        message: `Your report ${existing.reportNumber} (${existing.project} — ${existing.feature}) was ${statusVerb} by ${admin.name || admin.email || "Admin"}.${input.adminNotes ? ` Notes: ${input.adminNotes}` : ""}`,
        type: input.status === "approved" ? "success" : input.status === "draft" ? "warning" : "info",
        entityId: input.id,
      });

      await logWorkProgressActivity({
        userId: admin.id,
        userName: admin.name || admin.email,
        action:
          input.status === "approved"
            ? "WORK_PROGRESS_APPROVED"
            : input.status === "reviewed"
            ? "WORK_PROGRESS_REVIEWED"
            : "WORK_PROGRESS_SENT_BACK",
        entityId: input.id,
        metadata: { reportNumber: existing.reportNumber, project: existing.project, feature: existing.feature, adminNotes: input.adminNotes },
      });

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

      await logWorkProgressActivity({
        userId: user.id,
        userName: user.name || user.email,
        action: "WORK_PROGRESS_DELETED",
        entityId: input.id,
        metadata: { reportNumber: existing.reportNumber, project: existing.project, feature: existing.feature },
      });

      return { success: true };
    }),

  /** Admin: get staff list for filter dropdown (excludes admins) */
  getStaffList: adminQuery.query(async () => {
    const db = getDb();
    const staff = await db
      .select({
        id: localUsers.id,
        name: localUsers.fullName,
        role: localUsers.role,
      })
      .from(localUsers)
      .where(and(
        eq(localUsers.status, "active"),
        // BUG FIX: exclude admins — this dropdown filters reports BY staff, admins don't submit reports
        or(
          eq(localUsers.role, "staff"),
          eq(localUsers.role, "developer"),
          eq(localUsers.role, "architecture_staff"),
        ),
      ))
      .orderBy(asc(localUsers.fullName));
    return staff;
  }),

  /** Staff: get status counts for own reports (server-side, accurate) */
  getMyStats: staffQuery.query(async ({ ctx }) => {
    const db = getDb();
    const user = ctx.unifiedUser!;
    const rows = await db
      .select({
        status: workProgressReports.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(workProgressReports)
      .where(eq(workProgressReports.staffId, user.id))
      .groupBy(workProgressReports.status);
    return countByStatus(rows);
  }),

  /** Admin: get status counts across all reports (server-side, accurate) */
  getAllStats: adminQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        status: workProgressReports.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(workProgressReports)
      .groupBy(workProgressReports.status);
    return countByStatus(rows);
  }),
});

// ─── Stats helper ────────────────────────────────────────────────────────
function countByStatus(rows: { status: string; count: number }[]): {
  total: number;
  draft: number;
  submitted: number;
  reviewed: number;
  approved: number;
} {
  const out = { total: 0, draft: 0, submitted: 0, reviewed: 0, approved: 0 };
  for (const r of rows) {
    const n = Number(r.count);
    out.total += n;
    if (r.status === "draft") out.draft = n;
    else if (r.status === "submitted") out.submitted = n;
    else if (r.status === "reviewed") out.reviewed = n;
    else if (r.status === "approved") out.approved = n;
  }
  return out;
}
