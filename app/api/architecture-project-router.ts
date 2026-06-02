import { z } from "zod";
import { eq, like, desc, count, and, or, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery, architectureStaffQuery, architectureStaffOnlyQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  architectureProjects,
  architectureCategories,
  architectureProjectFiles,
  localUsers,
} from "@db/schema";
import {
  logArchitectureActivity,
  notifyAdminsForArchitectureApproval,
  notifyArchitectureCreator,
  generateArchitectureCode,
} from "./architecture-activity-helper";
import { actorDisplayName } from "./lib/access-control";

export const architectureProjectRouter = createRouter({
  list: architectureStaffQuery
    .input(z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      categoryId: z.number().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(architectureProjects.deletedAt)];

      if (input.search) {
        conditions.push(or(
          like(architectureProjects.title, `%${input.search}%`),
          like(architectureProjects.projectCode, `%${input.search}%`)
        ) as any);
      }
      if (input.status) conditions.push(eq(architectureProjects.status, input.status as any));
      if (input.categoryId) conditions.push(eq(architectureProjects.categoryId, input.categoryId));

      if (ctx.unifiedUser!.role === "architecture_staff") {
        conditions.push(eq(architectureProjects.createdBy, ctx.unifiedUser!.id));
      }

      const whereClause = and(...conditions);
      const totalResult = await db.select({ count: count() }).from(architectureProjects).where(whereClause);
      const total = totalResult[0]?.count || 0;
      const offset = (input.page - 1) * input.limit;

      const results = await db
        .select({
          id: architectureProjects.id,
          projectCode: architectureProjects.projectCode,
          title: architectureProjects.title,
          categoryId: architectureProjects.categoryId,
          categoryName: architectureCategories.name,
          projectLocation: architectureProjects.projectLocation,
          status: architectureProjects.status,
          estimatedCost: architectureProjects.estimatedCost,
          createdBy: architectureProjects.createdBy,
          staffName: localUsers.fullName,
          createdAt: architectureProjects.createdAt,
        })
        .from(architectureProjects)
        .leftJoin(architectureCategories, eq(architectureProjects.categoryId, architectureCategories.id))
        .leftJoin(localUsers, eq(architectureProjects.createdBy, localUsers.id))
        .where(whereClause)
        .orderBy(desc(architectureProjects.createdAt))
        .limit(input.limit)
        .offset(offset);

      return { items: results, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  getById: architectureStaffQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const project = await db
        .select()
        .from(architectureProjects)
        .where(and(eq(architectureProjects.id, input.id), isNull(architectureProjects.deletedAt)))
        .limit(1);

      if (project.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

      if (ctx.unifiedUser!.role === "architecture_staff" && project[0].createdBy !== ctx.unifiedUser!.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const files = await db
        .select()
        .from(architectureProjectFiles)
        .where(eq(architectureProjectFiles.projectId, input.id));

      const category = await db
        .select({ name: architectureCategories.name })
        .from(architectureCategories)
        .where(eq(architectureCategories.id, project[0].categoryId))
        .limit(1);

      return { ...project[0], files, categoryName: category[0]?.name };
    }),

  create: architectureStaffOnlyQuery
    .input(z.object({
      title: z.string().min(2).max(255),
      categoryId: z.number(),
      description: z.string().optional(),
      designConcept: z.string().optional(),
      projectLocation: z.string().optional(),
      landSize: z.string().optional(),
      buildingSize: z.string().optional(),
      numberOfFloors: z.number().optional(),
      estimatedCompletionTime: z.string().optional(),
      estimatedCost: z.string().optional(),
      features: z.array(z.string()).optional(),
      specialFeatures: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = actorDisplayName(ctx.unifiedUser);

      const category = await db
        .select()
        .from(architectureCategories)
        .where(and(eq(architectureCategories.id, input.categoryId), isNull(architectureCategories.deletedAt)))
        .limit(1);
      if (category.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });

      const projectCode = generateArchitectureCode("ARCH");
      const result = await db.insert(architectureProjects).values({
        ...input,
        projectCode,
        status: "draft",
        createdBy: userId,
      });

      const id = Number(result[0].insertId);

      await logArchitectureActivity({
        userId,
        userName,
        action: "project_created",
        entityType: "project",
        entityId: id,
        newValue: { title: input.title, categoryId: input.categoryId },
      });

      return { id, projectCode };
    }),

  update: architectureStaffOnlyQuery
    .input(z.object({
      id: z.number(),
      title: z.string().min(2).max(255).optional(),
      categoryId: z.number().optional(),
      description: z.string().optional(),
      designConcept: z.string().optional(),
      projectLocation: z.string().optional(),
      landSize: z.string().optional(),
      buildingSize: z.string().optional(),
      numberOfFloors: z.number().optional(),
      estimatedCompletionTime: z.string().optional(),
      estimatedCost: z.string().optional(),
      features: z.array(z.string()).optional(),
      specialFeatures: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = actorDisplayName(ctx.unifiedUser);

      const existing = await db
        .select()
        .from(architectureProjects)
        .where(and(eq(architectureProjects.id, id), isNull(architectureProjects.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      if (existing[0].createdBy !== userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      if (!["draft", "rejected"].includes(existing[0].status)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only draft or rejected projects can be edited" });
      }

      await db.update(architectureProjects).set(data).where(eq(architectureProjects.id, id));

      await logArchitectureActivity({
        userId,
        userName,
        action: "project_updated",
        entityType: "project",
        entityId: id,
        previousValue: existing[0],
        newValue: data,
      });

      return { success: true };
    }),

  addFile: architectureStaffOnlyQuery
    .input(z.object({
      projectId: z.number(),
      fileName: z.string(),
      fileUrl: z.string(),
      fileType: z.string(),
      fileSize: z.number(),
      category: z.enum([
        "pdf_drawing", "autocad", "image", "render", "video", "document",
        "floor_plan", "design_2d", "design_3d", "attachment", "other",
      ]).default("other"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;

      const project = await db
        .select()
        .from(architectureProjects)
        .where(and(eq(architectureProjects.id, input.projectId), isNull(architectureProjects.deletedAt)))
        .limit(1);

      if (project.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      if (project[0].createdBy !== userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });

      const result = await db.insert(architectureProjectFiles).values({
        ...input,
        uploadedBy: userId,
      });

      return { id: Number(result[0].insertId) };
    }),

  submit: architectureStaffOnlyQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = actorDisplayName(ctx.unifiedUser);

      const existing = await db
        .select()
        .from(architectureProjects)
        .where(and(eq(architectureProjects.id, input.id), isNull(architectureProjects.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      if (existing[0].createdBy !== userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      if (!["draft", "rejected"].includes(existing[0].status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Project cannot be submitted" });
      }

      await db
        .update(architectureProjects)
        .set({ status: "submitted", rejectionReason: null })
        .where(eq(architectureProjects.id, input.id));

      await logArchitectureActivity({
        userId,
        userName,
        action: "project_submitted",
        entityType: "project",
        entityId: input.id,
        previousValue: { status: existing[0].status },
        newValue: { status: "submitted" },
      });

      await notifyAdminsForArchitectureApproval({
        submitterName: userName,
        entityType: "Project",
        entityName: existing[0].title,
        entityId: input.id,
      });

      return { success: true };
    }),

  review: adminQuery
    .input(z.object({
      id: z.number(),
      action: z.enum(["approve", "reject", "start_review"]),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = actorDisplayName(ctx.unifiedUser);

      const existing = await db
        .select()
        .from(architectureProjects)
        .where(and(eq(architectureProjects.id, input.id), isNull(architectureProjects.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

      if (input.action !== "start_review" && existing[0].createdBy === userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot approve or reject your own project" });
      }

      let status = existing[0].status;
      if (input.action === "start_review") status = "under_review";
      else if (input.action === "approve") status = "approved";
      else if (input.action === "reject") status = "rejected";

      const updateData: Record<string, unknown> = {
        status,
        approvedBy: userId,
        approvedAt: new Date(),
      };
      if (input.reason && input.action === "reject") updateData.rejectionReason = input.reason;

      await db.update(architectureProjects).set(updateData).where(eq(architectureProjects.id, input.id));

      await logArchitectureActivity({
        userId,
        userName,
        action: `project_${input.action}`,
        entityType: "project",
        entityId: input.id,
        previousValue: { status: existing[0].status },
        newValue: updateData,
      });

      if (input.action === "approve" || input.action === "reject") {
        await notifyArchitectureCreator({
          creatorId: existing[0].createdBy,
          entityType: "Project",
          entityName: existing[0].title,
          action: input.action === "approve" ? "approved" : "rejected",
          reason: input.reason,
          entityId: input.id,
        });
      }

      return { success: true };
    }),

  delete: architectureStaffQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const isAdmin = ctx.unifiedUser!.role === "admin";

      const existing = await db
        .select()
        .from(architectureProjects)
        .where(and(eq(architectureProjects.id, input.id), isNull(architectureProjects.deletedAt)))
        .limit(1);

      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      if (!isAdmin && existing[0].createdBy !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      await db.update(architectureProjects).set({ deletedAt: new Date() }).where(eq(architectureProjects.id, input.id));
      return { success: true };
    }),

  stats: architectureStaffQuery.query(async ({ ctx }) => {
    const db = getDb();
    const conditions = [isNull(architectureProjects.deletedAt)];
    if (ctx.unifiedUser!.role === "architecture_staff") {
      conditions.push(eq(architectureProjects.createdBy, ctx.unifiedUser!.id));
    }

    const whereClause = and(...conditions);
    const total = await db.select({ count: count() }).from(architectureProjects).where(whereClause);
    const approved = await db.select({ count: count() }).from(architectureProjects).where(and(whereClause, eq(architectureProjects.status, "approved")));
    const pending = await db.select({ count: count() }).from(architectureProjects).where(and(whereClause, or(eq(architectureProjects.status, "submitted"), eq(architectureProjects.status, "under_review")) as any));
    const completed = await db.select({ count: count() }).from(architectureProjects).where(and(whereClause, eq(architectureProjects.status, "completed")));

    return {
      total: total[0]?.count || 0,
      approved: approved[0]?.count || 0,
      pending: pending[0]?.count || 0,
      completed: completed[0]?.count || 0,
    };
  }),
});
