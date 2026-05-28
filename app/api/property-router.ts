import { z } from "zod";
import { eq, and, like, desc, sql, or, count, ne, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { format } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { createRouter, adminQuery, staffQuery, publicQuery } from "./middleware";
import { logger } from "./lib/logger";
import { getDb } from "./queries/connection";
import {
  properties,
  propertyAgreements,
  propertyDocuments,
  verificationProcesses,
  finalLagthrams,
  propertyTypes,
  localUsers,
  approvalHistory,
  activityLogs,
  notifications,
  propertyImages,
  propertyPriceHistory,
} from "@db/schema";

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

function fmtPlain(val: string | number | null | undefined): string {
  const n = typeof val === "number" ? val : parseFloat(val ?? "0");
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

export const propertyRouter = createRouter({
  create: staffQuery
    .input(
      z.object({
        propertyName: z.string().min(1, "⚠️ Property Name is required. Please enter the property name.").max(255, "⚠️ Property Name is too long. Maximum 255 characters allowed."),
        propertyTypeId: z.number().min(1, "⚠️ Property Type is required. Please select a property type from the dropdown."),
        address: z.string().min(1, "⚠️ Property Address is required. Please enter the property address."),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        ownerName: z.string().min(1, "⚠️ Owner Name is required. Please enter the property owner's full name.").max(255, "⚠️ Owner Name is too long. Maximum 255 characters allowed."),
        ownerCID: z.string().min(11, "⚠️ Owner CID must be exactly 11 digits. Please enter a valid 11-digit CID number.").max(11, "⚠️ Owner CID must be exactly 11 digits. Please enter a valid 11-digit CID number.").regex(/^\d+$/, "⚠️ Owner CID must contain only numbers (0-9). Please enter a valid 11-digit CID."),
        ownerPhone: z.string().min(1, "⚠️ Owner Phone is required. Please enter the owner's phone number.").max(20, "⚠️ Phone number is too long. Maximum 20 characters allowed."),
        ownerAddress: z.string().min(1, "⚠️ Owner Address is required. Please enter the owner's address."),
        buyerName: z.string().max(255).optional(),
        buyerCID: z.string().length(11, "⚠️ Buyer CID must be exactly 11 digits.").optional(),
        buyerPhone: z.string().max(20).optional(),
        buyerAddress: z.string().optional(),
        sellingPrice: z.string().min(1, "⚠️ Selling Price is required. Please enter the property selling price."),
        realEstateFee: z.string().min(1, "⚠️ Commission amount is required. Please try again."),
        loanAmount: z.string().min(1, "⚠️ Loan Amount is required. Please enter the loan amount."),
        pricePerDecimal: z.string().optional(),
        landSizeDecimal: z.string().optional(),
        negotiatedPrice: z.string().optional(),
        discountAmount: z.string().optional(),
        finalSellingPrice: z.string().optional(),
        priceOverrideReason: z.string().optional(),
        thramNumber: z.string().optional(),
        plotNumber: z.string().optional(),
        noObjectionLetter: z.string().optional(),
        images: z.array(z.object({
          url: z.string(),
          publicId: z.string().optional()
        })).optional(),
        features: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name;

      // Validate inputs before insert
      if (!input.propertyName || input.propertyName.trim().length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Property Name is required. Please enter the property name." });
      }
      if (!input.propertyTypeId || input.propertyTypeId <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Property Type is required. Please select a property type from the dropdown." });
      }
      if (!input.address || input.address.trim().length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Address is required. Please enter the property address." });
      }
      if (!input.ownerName || input.ownerName.trim().length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Owner Name is required. Please enter the property owner's full name." });
      }
      if (!input.ownerCID || input.ownerCID.length !== 11) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Owner CID must be exactly 11 digits. Please enter a valid 11-digit CID number." });
      }
      if (!input.ownerPhone || input.ownerPhone.trim().length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Owner Phone is required. Please enter the owner's phone number." });
      }
      if (!input.ownerAddress || input.ownerAddress.trim().length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Owner Address is required. Please enter the owner's address." });
      }
      if (!input.sellingPrice || isNaN(parseFloat(input.sellingPrice)) || parseFloat(input.sellingPrice) <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Selling Price is required and must be a valid positive number." });
      }
      if (!input.realEstateFee || isNaN(parseFloat(input.realEstateFee))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Commission amount could not be calculated. Please try again." });
      }
      if (!input.loanAmount || isNaN(parseFloat(input.loanAmount)) || parseFloat(input.loanAmount) < 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Loan Amount is required and must be a valid non-negative number." });
      }

      // Fetch property type to determine if Land
      const propType = await db.select({ name: propertyTypes.name })
        .from(propertyTypes)
        .where(eq(propertyTypes.id, Number(input.propertyTypeId)))
        .limit(1);
      const isLandType = propType[0]?.name === "Land";

      // ── Land Pricing Calculation ──────────────────────────────────────
      function parseDecimal(val: string | undefined, scale: number): string | null {
        if (!val || val.trim() === "") return null;
        const n = parseFloat(val);
        if (isNaN(n) || n < 0) return null;
        return n.toFixed(scale);
      }

      let sellingPriceNum: string;
      let realEstateFeeNum: string;
      let pricePerDecimal: string | null = null;
      let landSizeDecimal: string | null = null;
      let negotiatedPrice: string | null = null;
      let discountAmount: string | null = null;
      let finalSellingPriceNum: string | null = null;

      // Parse landSizeDecimal for ALL property types (not just Land)
      landSizeDecimal = parseDecimal(input.landSizeDecimal, 4);

      if (isLandType) {
        pricePerDecimal = parseDecimal(input.pricePerDecimal, 4);
        negotiatedPrice = parseDecimal(input.negotiatedPrice, 2);
        discountAmount = parseDecimal(input.discountAmount, 2);

        // Auto-calculate sellingPrice from pricePerDecimal × landSizeDecimal if both provided
        let computedSellingPrice = parseFloat(input.sellingPrice);
        if (pricePerDecimal && landSizeDecimal) {
          computedSellingPrice = parseFloat(pricePerDecimal) * parseFloat(landSizeDecimal);
        }
        sellingPriceNum = computedSellingPrice.toFixed(2);

        // Calculate finalSellingPrice
        let finalPrice = computedSellingPrice;
        if (negotiatedPrice) {
          finalPrice = parseFloat(negotiatedPrice) - parseFloat(discountAmount || "0");
        } else if (discountAmount) {
          finalPrice = computedSellingPrice - parseFloat(discountAmount);
        }
        finalSellingPriceNum = finalPrice > 0 ? finalPrice.toFixed(2) : sellingPriceNum;

        // Commission is 3% of final selling price
        realEstateFeeNum = (parseFloat(finalSellingPriceNum) * 0.03).toFixed(2);
      } else {
        // Non-Land: use manual selling price
        const sp = parseFloat(input.sellingPrice);
        sellingPriceNum = sp.toFixed(2);
        realEstateFeeNum = (sp * 0.03).toFixed(2);
      }

      // Validate and convert latitude/longitude to proper decimal format
      let latitudeVal: string | null = null;
      let longitudeVal: string | null = null;
      if (input.latitude) {
        const lat = parseFloat(input.latitude);
        if (!isNaN(lat) && lat >= -90 && lat <= 90) {
          latitudeVal = lat.toFixed(8);
        }
      }
      if (input.longitude) {
        const lng = parseFloat(input.longitude);
        if (!isNaN(lng) && lng >= -180 && lng <= 180) {
          longitudeVal = lng.toFixed(8);
        }
      }

      const isAdmin = ctx.unifiedUser!.role === "admin";
      const isPriceOverride = isAdmin && input.priceOverrideReason && input.priceOverrideReason.trim().length > 0;

      const result = await db.transaction(async (tx) => {
        const insertResult = await tx.insert(properties).values({
          propertyName: input.propertyName,
          propertyTypeId: Number(input.propertyTypeId),
          address: input.address,
          latitude: latitudeVal,
          longitude: longitudeVal,
          ownerName: input.ownerName,
          ownerCID: input.ownerCID,
          ownerPhone: input.ownerPhone,
          ownerAddress: input.ownerAddress,
          buyerName: input.buyerName || null,
          buyerCID: input.buyerCID || null,
          buyerPhone: input.buyerPhone || null,
          buyerAddress: input.buyerAddress || null,
          sellingPrice: sellingPriceNum,
          realEstateFee: realEstateFeeNum,
          loanAmount: parseFloat(input.loanAmount).toFixed(2),
          pricePerDecimal,
          landSizeDecimal,
          negotiatedPrice,
          discountAmount,
          finalSellingPrice: finalSellingPriceNum,
          priceOverrideBy: isPriceOverride ? userId : null,
          priceOverrideAt: isPriceOverride ? new Date() : null,
          priceOverrideReason: isPriceOverride ? input.priceOverrideReason : null,
          thramNumber: isLandType ? (input.thramNumber || null) : null,
          plotNumber: isLandType ? (input.plotNumber || null) : null,
          noObjectionLetter: input.noObjectionLetter || null,
          currentStep: isAdmin ? 2 : 1,
          approvalStatus: isAdmin ? "approved" : "submitted",
          workflowStatus: isAdmin ? "processing" : "pending",
          listedById: Number(userId),
          features: input.features ? JSON.stringify(input.features) : null,
        });

        const propertyId = Number(insertResult[0].insertId);

        // Save images if provided
        if (input.images && input.images.length > 0) {
          const imageValues = input.images.map(img => ({
            propertyId,
            url: img.url,
            publicId: img.publicId
          }));
          await tx.insert(propertyImages).values(imageValues);
        }

        await tx.insert(activityLogs).values({
          userId,
          userName: ctx.unifiedUser!.name,
          action: "PROPERTY_CREATED",
          entityType: "property",
          entityId: propertyId,
          metadata: {
            propertyName: input.propertyName,
            sellingPrice: sellingPriceNum,
            finalSellingPrice: finalSellingPriceNum,
            pricePerDecimal,
            landSizeDecimal,
          },
        });

        // Log price history if land pricing fields provided
        if (pricePerDecimal || landSizeDecimal) {
          const historyEntries = [];
          if (pricePerDecimal) {
            historyEntries.push({
              propertyId,
              fieldName: "pricePerDecimal",
              oldValue: null,
              newValue: pricePerDecimal,
              changedBy: userId,
              changedByName: userName,
              reason: isPriceOverride ? input.priceOverrideReason : "Auto-calculated on creation",
            });
          }
          if (landSizeDecimal) {
            historyEntries.push({
              propertyId,
              fieldName: "landSizeDecimal",
              oldValue: null,
              newValue: landSizeDecimal,
              changedBy: userId,
              changedByName: userName,
              reason: isPriceOverride ? input.priceOverrideReason : "Auto-calculated on creation",
            });
          }
          if (negotiatedPrice) {
            historyEntries.push({
              propertyId,
              fieldName: "negotiatedPrice",
              oldValue: null,
              newValue: negotiatedPrice,
              changedBy: userId,
              changedByName: userName,
              reason: isPriceOverride ? input.priceOverrideReason : "Negotiated price on creation",
            });
          }
          if (discountAmount) {
            historyEntries.push({
              propertyId,
              fieldName: "discountAmount",
              oldValue: null,
              newValue: discountAmount,
              changedBy: userId,
              changedByName: userName,
              reason: isPriceOverride ? input.priceOverrideReason : "Discount applied on creation",
            });
          }
          historyEntries.push({
            propertyId,
            fieldName: "sellingPrice",
            oldValue: null,
            newValue: sellingPriceNum,
            changedBy: userId,
            changedByName: userName,
            reason: isPriceOverride ? input.priceOverrideReason : "Auto-calculated from pricePerDecimal × landSizeDecimal",
          });
          historyEntries.push({
            propertyId,
            fieldName: "finalSellingPrice",
            oldValue: null,
            newValue: finalSellingPriceNum,
            changedBy: userId,
            changedByName: userName,
            reason: isPriceOverride ? input.priceOverrideReason : "Auto-calculated final price",
          });
          if (historyEntries.length > 0) {
            await tx.insert(propertyPriceHistory).values(historyEntries);
          }
        }

        if (isAdmin) {
          await tx.insert(approvalHistory).values({
            propertyId,
            step: 1,
            action: "approved",
            adminId: userId,
            comments: "Auto-approved by admin",
          });
        } else {
          await tx.insert(approvalHistory).values({
            propertyId,
            step: 1,
            action: "submitted",
            adminId: userId,
            comments: "Property information submitted for review",
          });

          const admins = await tx.select({ id: localUsers.id }).from(localUsers).where(eq(localUsers.role, "admin"));
          if (admins.length > 0) {
            const notificationValues = admins.map(admin => ({
              userId: admin.id,
              title: "New Property Pending Approval",
              message: `${userName} submitted a new property "${input.propertyName}". Please review and approve Step 1.`,
              type: "approval" as const,
              entityType: "property",
              entityId: propertyId,
            }));
            await tx.insert(notifications).values(notificationValues);
          }
        }

        return { id: propertyId, ...input };
      });

      return result;
    }),

  list: staffQuery
    .input(
      z.object({
        search: z.string().optional(),
        status: z.enum(["draft", "submitted", "pending_review", "approved", "rejected", "completed", "cancelled"]).optional(),
        workflowStatus: z.enum(["pending", "processing", "approved", "rejected", "completed", "cancelled"]).optional(),
        propertyTypeId: z.number().optional(),
        listedById: z.number().optional(),
        step: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).default(20),
      }).default(() => ({ page: 1, limit: 20 }))
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [];

      // Fast property search: property name prioritized, then other fields
      const rawSearch = input.search?.trim();
      if (rawSearch) {
        const searchTerms = rawSearch.split(/\s+/).filter(t => t.length > 0);
        
        const searchConditions = searchTerms.map((term) => {
          const escaped = term.replace(/[%_]/g, "\\$&");
          // Priority: property name gets prefix match (fastest with index), others get contains
          return or(
            like(properties.propertyName, `${escaped}%`),     // prefix match — fastest
            like(properties.propertyName, `%${escaped}%`),    // contains — medium
            like(properties.ownerName, `%${escaped}%`),
            like(properties.ownerCID, `%${escaped}%`),
            like(properties.ownerPhone, `%${escaped}%`),
            like(properties.ownerAddress, `%${escaped}%`),
            like(properties.buyerName, `%${escaped}%`),
            like(properties.buyerCID, `%${escaped}%`),
            like(properties.buyerPhone, `%${escaped}%`),
            like(properties.buyerAddress, `%${escaped}%`),
            like(properties.address, `%${escaped}%`),
            like(properties.thramNumber, `%${escaped}%`),
            like(properties.plotNumber, `%${escaped}%`)
          );
        });
        if (searchConditions.length === 1) {
          conditions.push(searchConditions[0]);
        } else if (searchConditions.length > 1) {
          // All terms must match (AND logic) — but each term can match any field
          conditions.push(and(...searchConditions));
        }
      }

      if (input.status) conditions.push(eq(properties.approvalStatus, input.status));
      if (input.workflowStatus) conditions.push(eq(properties.workflowStatus, input.workflowStatus));
      if (input.propertyTypeId) conditions.push(eq(properties.propertyTypeId, input.propertyTypeId));
      if (input.step) conditions.push(eq(properties.currentStep, input.step));

      if (ctx.unifiedUser!.role === "staff") {
        conditions.push(eq(properties.listedById, ctx.unifiedUser!.id));
      } else if (input.listedById) {
        conditions.push(eq(properties.listedById, input.listedById));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const totalResult = await db.select({ count: count() }).from(properties).where(whereClause);
      const total = totalResult[0]?.count || 0;

      const page = input.page || 1;
      const limit = input.limit || 20;
      const offset = (page - 1) * limit;

      const results = await db
        .select({
          id: properties.id,
          propertyName: properties.propertyName,
          propertyTypeId: properties.propertyTypeId,
          address: properties.address,
          latitude: properties.latitude,
          longitude: properties.longitude,
          ownerName: properties.ownerName,
          ownerCID: properties.ownerCID,
          ownerPhone: properties.ownerPhone,
          buyerName: properties.buyerName,
          buyerCID: properties.buyerCID,
          buyerPhone: properties.buyerPhone,
          buyerAddress: properties.buyerAddress,
          sellingPrice: properties.sellingPrice,
          realEstateFee: properties.realEstateFee,
          loanAmount: properties.loanAmount,
          pricePerDecimal: properties.pricePerDecimal,
          landSizeDecimal: properties.landSizeDecimal,
          negotiatedPrice: properties.negotiatedPrice,
          discountAmount: properties.discountAmount,
          finalSellingPrice: properties.finalSellingPrice,
          priceOverrideBy: properties.priceOverrideBy,
          priceOverrideAt: properties.priceOverrideAt,
          priceOverrideReason: properties.priceOverrideReason,
          thramNumber: properties.thramNumber,
          plotNumber: properties.plotNumber,
          currentStep: properties.currentStep,
          approvalStatus: properties.approvalStatus,
          workflowStatus: properties.workflowStatus,
          listedById: properties.listedById,
          noObjectionLetter: properties.noObjectionLetter,
          adminNotes: properties.adminNotes,
          rejectionComments: properties.rejectionComments,
          completedAt: properties.completedAt,
          isSold: properties.isSold,
          features: properties.features,
          createdAt: properties.createdAt,
          updatedAt: properties.updatedAt,
          propertyTypeName: propertyTypes.name,
          listedByName: localUsers.fullName,
        })
        .from(properties)
        .leftJoin(propertyTypes, eq(properties.propertyTypeId, propertyTypes.id))
        .leftJoin(localUsers, eq(properties.listedById, localUsers.id))
        .where(whereClause)
        .orderBy(desc(properties.createdAt))
        .limit(limit)
        .offset(offset);

      const propertyIds = results.map(p => p.id);
      const allImages = propertyIds.length > 0
        ? await db.select().from(propertyImages).where(inArray(propertyImages.propertyId, propertyIds))
        : [];

      const resultsWithImages = results.map(p => ({
        ...p,
        images: allImages.filter(img => img.propertyId === p.id)
      }));

      return { items: resultsWithImages, total, page, limit, totalPages: Math.ceil(total / limit) };
    }),

  getById: staffQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();

      const property = await db
        .select({
          id: properties.id,
          propertyName: properties.propertyName,
          propertyTypeId: properties.propertyTypeId,
          address: properties.address,
          latitude: properties.latitude,
          longitude: properties.longitude,
          ownerName: properties.ownerName,
          ownerCID: properties.ownerCID,
          ownerPhone: properties.ownerPhone,
          ownerAddress: properties.ownerAddress,
          buyerName: properties.buyerName,
          buyerCID: properties.buyerCID,
          buyerPhone: properties.buyerPhone,
          buyerAddress: properties.buyerAddress,
          sellingPrice: properties.sellingPrice,
          realEstateFee: properties.realEstateFee,
          loanAmount: properties.loanAmount,
          pricePerDecimal: properties.pricePerDecimal,
          landSizeDecimal: properties.landSizeDecimal,
          negotiatedPrice: properties.negotiatedPrice,
          discountAmount: properties.discountAmount,
          finalSellingPrice: properties.finalSellingPrice,
          priceOverrideBy: properties.priceOverrideBy,
          priceOverrideAt: properties.priceOverrideAt,
          priceOverrideReason: properties.priceOverrideReason,
          thramNumber: properties.thramNumber,
          plotNumber: properties.plotNumber,
          currentStep: properties.currentStep,
          approvalStatus: properties.approvalStatus,
          workflowStatus: properties.workflowStatus,
          listedById: properties.listedById,
          noObjectionLetter: properties.noObjectionLetter,
          adminNotes: properties.adminNotes,
          rejectionComments: properties.rejectionComments,
          completedAt: properties.completedAt,
          isSold: properties.isSold,
          features: properties.features,
          createdAt: properties.createdAt,
          updatedAt: properties.updatedAt,
          propertyTypeName: propertyTypes.name,
          listedByName: localUsers.fullName,
        })
        .from(properties)
        .leftJoin(propertyTypes, eq(properties.propertyTypeId, propertyTypes.id))
        .leftJoin(localUsers, eq(properties.listedById, localUsers.id))
        .where(eq(properties.id, input.id))
        .limit(1);

      if (property.length === 0) return null;

      if (ctx.unifiedUser!.role === "staff" && property[0].listedById !== ctx.unifiedUser!.id) {
        return null;
      }

      const images = await db
        .select()
        .from(propertyImages)
        .where(eq(propertyImages.propertyId, input.id));

      return { ...property[0], images };
    }),

  update: staffQuery
    .input(
      z.object({
        id: z.number(),
        propertyName: z.string().min(1).max(255).optional(),
        propertyTypeId: z.number().optional(),
        address: z.string().min(1).optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        ownerName: z.string().min(1).max(255).optional(),
        ownerCID: z.string().length(11).optional(),
        ownerPhone: z.string().min(1).max(20).optional(),
        ownerAddress: z.string().min(1).optional(),
        buyerName: z.string().max(255).optional(),
        buyerCID: z.string().length(11).optional(),
        buyerPhone: z.string().max(20).optional(),
        buyerAddress: z.string().optional(),
        sellingPrice: z.string().optional(),
        realEstateFee: z.string().optional(),
        loanAmount: z.string().optional(),
        pricePerDecimal: z.string().optional(),
        landSizeDecimal: z.string().optional(),
        negotiatedPrice: z.string().optional(),
        discountAmount: z.string().optional(),
        finalSellingPrice: z.string().optional(),
        priceOverrideReason: z.string().optional(),
        noObjectionLetter: z.string().optional(),
        adminNotes: z.string().optional(),
        rejectionComments: z.string().optional(),
        thramNumber: z.string().optional(),
        plotNumber: z.string().optional(),
        images: z.array(z.object({
          url: z.string(),
          publicId: z.string().optional()
        })).optional(),
        features: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, images, adminNotes, rejectionComments, ...data } = input;
      const db = getDb();

      // Stringify features for MySQL JSON column
      if (data.features !== undefined) {
        data.features = data.features ? JSON.stringify(data.features) : null;
      }

      // ── Land Pricing Calculation for Update ───────────────────────────
      function parseDecimalUpd(val: string | undefined, scale: number): string | null {
        if (!val || val.trim() === "") return null;
        const n = parseFloat(val);
        if (isNaN(n) || n < 0) return null;
        return n.toFixed(scale);
      }

      // Fetch existing property for comparison
      const existingProp = await db.select({
        sellingPrice: properties.sellingPrice,
        realEstateFee: properties.realEstateFee,
        pricePerDecimal: properties.pricePerDecimal,
        landSizeDecimal: properties.landSizeDecimal,
        negotiatedPrice: properties.negotiatedPrice,
        discountAmount: properties.discountAmount,
        finalSellingPrice: properties.finalSellingPrice,
        propertyTypeId: properties.propertyTypeId,
        listedById: properties.listedById,
        approvalStatus: properties.approvalStatus,
      }).from(properties).where(eq(properties.id, id)).limit(1);

      if (existingProp.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }
      const oldProp = existingProp[0];

      // Check if property type is Land
      const propType = await db.select({ name: propertyTypes.name })
        .from(propertyTypes)
        .where(eq(propertyTypes.id, oldProp.propertyTypeId))
        .limit(1);
      const isLandType = propType[0]?.name === "Land";

      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name;
      const isAdmin = ctx.unifiedUser!.role === "admin";
      const isPriceOverride = isAdmin && data.priceOverrideReason && data.priceOverrideReason.trim().length > 0;

      let sellingPriceNum: string;
      let realEstateFeeNum: string;
      let newPricePerDecimal: string | null = oldProp.pricePerDecimal;
      let newLandSizeDecimal: string | null = oldProp.landSizeDecimal;
      let newNegotiatedPrice: string | null = oldProp.negotiatedPrice;
      let newDiscountAmount: string | null = oldProp.discountAmount;
      let finalSellingPriceNum: string | null = oldProp.finalSellingPrice;

      // Parse landSizeDecimal for ALL property types
      newLandSizeDecimal = data.landSizeDecimal !== undefined ? parseDecimalUpd(data.landSizeDecimal, 4) : oldProp.landSizeDecimal;

      if (isLandType) {
        // Parse new pricing values for Land
        newPricePerDecimal = data.pricePerDecimal !== undefined ? parseDecimalUpd(data.pricePerDecimal, 4) : oldProp.pricePerDecimal;
        newNegotiatedPrice = data.negotiatedPrice !== undefined ? parseDecimalUpd(data.negotiatedPrice, 2) : oldProp.negotiatedPrice;
        newDiscountAmount = data.discountAmount !== undefined ? parseDecimalUpd(data.discountAmount, 2) : oldProp.discountAmount;

        // Auto-recalculate sellingPrice if land pricing fields changed
        let computedSellingPrice = data.sellingPrice !== undefined ? parseFloat(data.sellingPrice) : parseFloat(oldProp.sellingPrice || "0");
        if (newPricePerDecimal && newLandSizeDecimal) {
          computedSellingPrice = parseFloat(newPricePerDecimal) * parseFloat(newLandSizeDecimal);
        }
        sellingPriceNum = computedSellingPrice.toFixed(2);

        // Calculate finalSellingPrice
        let finalPrice = computedSellingPrice;
        if (newNegotiatedPrice) {
          finalPrice = parseFloat(newNegotiatedPrice) - parseFloat(newDiscountAmount || "0");
        } else if (newDiscountAmount) {
          finalPrice = computedSellingPrice - parseFloat(newDiscountAmount);
        }
        finalSellingPriceNum = finalPrice > 0 ? finalPrice.toFixed(2) : sellingPriceNum;

        // Commission is 3% of final selling price
        realEstateFeeNum = (parseFloat(finalSellingPriceNum) * 0.03).toFixed(2);
      } else {
        // Non-Land: use manual selling price
        const sp = data.sellingPrice !== undefined ? parseFloat(data.sellingPrice) : parseFloat(oldProp.sellingPrice || "0");
        sellingPriceNum = sp.toFixed(2);
        realEstateFeeNum = (sp * 0.03).toFixed(2);
        // Clear land-specific pricing fields for non-Land
        newPricePerDecimal = null;
        newNegotiatedPrice = null;
        newDiscountAmount = null;
        finalSellingPriceNum = null;
      }

      // Update data with computed values
      data.sellingPrice = sellingPriceNum;
      data.realEstateFee = realEstateFeeNum;
      data.loanAmount = data.loanAmount !== undefined 
        ? parseFloat(data.loanAmount).toFixed(2) 
        : undefined;
      data.pricePerDecimal = newPricePerDecimal;
      data.landSizeDecimal = newLandSizeDecimal;
      data.negotiatedPrice = newNegotiatedPrice;
      data.discountAmount = newDiscountAmount;
      data.finalSellingPrice = finalSellingPriceNum;
      data.thramNumber = isLandType ? (data.thramNumber || null) : null;
      data.plotNumber = isLandType ? (data.plotNumber || null) : null;
      if (isPriceOverride) {
        data.priceOverrideBy = userId.toString();
        data.priceOverrideAt = new Date().toISOString();
      }

      // Validate numeric fields
      if (data.sellingPrice !== undefined) {
        const sp = parseFloat(data.sellingPrice);
        if (isNaN(sp) || sp <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Selling Price must be a valid positive number." });
        }
        data.sellingPrice = sp.toFixed(2);
      }
      if (data.realEstateFee !== undefined) {
        const fee = parseFloat(data.realEstateFee);
        if (isNaN(fee) || fee < 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Commission amount must be a valid non-negative number." });
        }
        data.realEstateFee = fee.toFixed(2);
      }

      // Ownership check BEFORE any side effects
      let staffProp: { listedById: number; approvalStatus: string } | null = null;
      if (ctx.unifiedUser!.role === "staff") {
        if (oldProp.listedById !== ctx.unifiedUser!.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to edit this property" });
        }
        staffProp = { listedById: oldProp.listedById, approvalStatus: oldProp.approvalStatus };
      }

      return await db.transaction(async (tx) => {
        // Handle image updates — delete old images from Cloudinary first
        if (images) {
          const oldImages = await tx.select({ publicId: propertyImages.publicId })
            .from(propertyImages)
            .where(eq(propertyImages.propertyId, id));

          // Delete old images from Cloudinary (fire-and-forget, don't block on failure)
          const oldPublicIds = oldImages.map(i => i.publicId).filter(Boolean) as string[];
          if (oldPublicIds.length > 0) {
            const { deleteCloudinaryImages } = await import("./services/cloudinary");
            deleteCloudinaryImages(oldPublicIds).catch((err: unknown) =>
              logger.error("Cloudinary cleanup error", { error: String(err) })
            );
          }

          await tx.delete(propertyImages).where(eq(propertyImages.propertyId, id));
          if (images.length > 0) {
            await tx.insert(propertyImages).values(
              images.map(img => ({
                propertyId: id,
                url: img.url,
                publicId: img.publicId
              }))
            );
          }
        }

        if (ctx.unifiedUser!.role === "staff") {
          // If property was rejected, reset to submitted and clear stale rejection comments
          if (staffProp!.approvalStatus === "rejected") {
            await tx.update(properties)
              .set({ ...data, approvalStatus: "submitted", rejectionComments: null })
              .where(eq(properties.id, id));
            return { success: true };
          }

          // Staff cannot modify admin-only fields
          await tx.update(properties).set(data).where(eq(properties.id, id));
          return { success: true };
        }

        // Admin update: allow adminNotes and rejectionComments
        const adminUpdateData: Record<string, unknown> = { ...data };
        if (adminNotes !== undefined) adminUpdateData.adminNotes = adminNotes;
        if (rejectionComments !== undefined) adminUpdateData.rejectionComments = rejectionComments;

        await tx.update(properties).set(adminUpdateData).where(eq(properties.id, id));

        // Log price history for changed fields
        const historyEntries = [];
        const fieldsToCheck: Array<{ key: string; oldVal: string | null; newVal: string | null }> = [
          { key: "pricePerDecimal", oldVal: oldProp.pricePerDecimal, newVal: newPricePerDecimal },
          { key: "landSizeDecimal", oldVal: oldProp.landSizeDecimal, newVal: newLandSizeDecimal },
          { key: "negotiatedPrice", oldVal: oldProp.negotiatedPrice, newVal: newNegotiatedPrice },
          { key: "discountAmount", oldVal: oldProp.discountAmount, newVal: newDiscountAmount },
          { key: "sellingPrice", oldVal: oldProp.sellingPrice, newVal: sellingPriceNum },
          { key: "finalSellingPrice", oldVal: oldProp.finalSellingPrice, newVal: finalSellingPriceNum },
        ];
        for (const field of fieldsToCheck) {
          if (field.newVal !== null && field.oldVal !== field.newVal) {
            historyEntries.push({
              propertyId: id,
              fieldName: field.key,
              oldValue: field.oldVal,
              newValue: field.newVal,
              changedBy: userId,
              changedByName: userName,
              reason: isPriceOverride ? data.priceOverrideReason : "Auto-recalculated on update",
            });
          }
        }
        if (historyEntries.length > 0) {
          await tx.insert(propertyPriceHistory).values(historyEntries);
        }

        // Activity log for price changes
        if (historyEntries.length > 0) {
          await tx.insert(activityLogs).values({
            userId,
            userName,
            action: "PRICE_CHANGED",
            entityType: "property",
            entityId: id,
            metadata: {
              sellingPrice: sellingPriceNum,
              finalSellingPrice: finalSellingPriceNum,
              fieldsChanged: historyEntries.map(h => h.fieldName),
            },
          });
        }

        return { success: true };
      });
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      return await db.transaction(async (tx) => {
        // Delete Cloudinary images before wiping DB rows
        const oldImages = await tx.select({ publicId: propertyImages.publicId })
          .from(propertyImages)
          .where(eq(propertyImages.propertyId, input.id));
        const oldPublicIds = oldImages.map(i => i.publicId).filter(Boolean) as string[];
        if (oldPublicIds.length > 0) {
          const { deleteCloudinaryImages } = await import("./services/cloudinary");
          deleteCloudinaryImages(oldPublicIds).catch((err: unknown) =>
            logger.error("Cloudinary cleanup error", { error: String(err) })
          );
        }

        // Cascade delete all related records
        await tx.delete(approvalHistory).where(eq(approvalHistory.propertyId, input.id));
        await tx.delete(notifications).where(and(eq(notifications.entityType, "property"), eq(notifications.entityId, input.id)));
        await tx.delete(finalLagthrams).where(eq(finalLagthrams.propertyId, input.id));
        await tx.delete(verificationProcesses).where(eq(verificationProcesses.propertyId, input.id));
        await tx.delete(propertyDocuments).where(eq(propertyDocuments.propertyId, input.id));
        await tx.delete(propertyAgreements).where(eq(propertyAgreements.propertyId, input.id));
        await tx.delete(propertyImages).where(eq(propertyImages.propertyId, input.id));
        await tx.delete(properties).where(eq(properties.id, input.id));
        return { success: true };
      });
    }),

  submitStep2: staffQuery
    .input(
      z.object({
        propertyId: z.number(),
        buyerName: z.string().min(1, "⚠️ Buyer Name is required.").max(255),
        buyerCID: z.string().length(11, "⚠️ Buyer CID must be exactly 11 digits."),
        buyerPhone: z.string().min(1, "⚠️ Buyer Phone is required.").max(20),
        buyerAddress: z.string().min(1, "⚠️ Buyer Address is required."),
        agreementFile: z.string().min(1, "Agreement file is required"),
        paymentScreenshot: z.string().min(1, "Payment screenshot is required"),
        commissionAmount: z.string().optional(),
        paymentAmount: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name;
      const isAdmin = ctx.unifiedUser!.role === "admin";

      // Validate numeric amount fields if provided
      if (input.commissionAmount !== undefined && input.commissionAmount.trim() !== "") {
        const ca = parseFloat(input.commissionAmount);
        if (isNaN(ca) || ca < 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Commission amount must be a valid non-negative number." });
        }
      }
      if (input.paymentAmount !== undefined && input.paymentAmount.trim() !== "") {
        const pa = parseFloat(input.paymentAmount);
        if (isNaN(pa) || pa < 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Payment amount must be a valid non-negative number." });
        }
      }

      return await db.transaction(async (tx) => {
        const prop = await tx.select().from(properties).where(eq(properties.id, input.propertyId)).limit(1);
        if (prop.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
        if (ctx.unifiedUser!.role === "staff" && prop[0].listedById !== userId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
        }

        // Step 1 must be approved before staff can work on Step 2
        if (!isAdmin && prop[0].currentStep < 2) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Step 1 (Property Information) must be approved by admin before proceeding to Step 2. Please wait for admin approval." });
        }

        // Block resubmission while Step 2 is pending admin review
        if (!isAdmin && prop[0].approvalStatus === "pending_review" && prop[0].currentStep === 2) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Step 2 is already submitted and waiting for admin approval. Please wait for approval before resubmitting." });
        }
        const existing = await tx.select().from(propertyAgreements)
          .where(eq(propertyAgreements.propertyId, input.propertyId))
          .limit(1);

        const values = {
          agreementFile: input.agreementFile,
          paymentScreenshot: input.paymentScreenshot,
          commissionAmount: input.commissionAmount,
          paymentAmount: input.paymentAmount,
          approvalStatus: isAdmin ? "approved" as const : "pending" as const,
        };

        if (existing.length > 0) {
          await tx.update(propertyAgreements)
            .set({ ...values, comments: null, ...(isAdmin ? { approvedBy: userId, approvedAt: new Date() } : {}) })
            .where(eq(propertyAgreements.propertyId, input.propertyId));
        } else {
          await tx.insert(propertyAgreements).values({
            propertyId: input.propertyId,
            ...values,
            ...(isAdmin ? { approvedBy: userId, approvedAt: new Date() } : {}),
          });
        }

        await tx.update(properties)
          .set({
            currentStep: isAdmin ? 3 : 2,
            approvalStatus: isAdmin ? "approved" : "pending_review",
            buyerName: input.buyerName,
            buyerCID: input.buyerCID,
            buyerPhone: input.buyerPhone,
            buyerAddress: input.buyerAddress,
          })
          .where(eq(properties.id, input.propertyId));

        if (isAdmin) {
          await tx.insert(approvalHistory).values({
            propertyId: input.propertyId,
            step: 2,
            action: "approved",
            adminId: userId,
            comments: "Auto-approved by admin",
          });

          // Notify the staff who listed the property
          if (prop[0].listedById !== userId) {
            await tx.insert(notifications).values({
              userId: prop[0].listedById,
              title: "Step 2 Auto-Approved",
              message: `Step 2 (Agreement & Payment) for "${prop[0].propertyName}" has been auto-approved by admin.`,
              type: "success",
              entityType: "property",
              entityId: input.propertyId,
            });
          }
        } else {
          const admins = await tx.select({ id: localUsers.id }).from(localUsers).where(eq(localUsers.role, "admin"));
          if (admins.length > 0) {
            const notificationValues = admins.map(admin => ({
              userId: admin.id,
              title: "Step 2 Pending Approval",
              message: `${userName} submitted Agreement & Payment for "${prop[0].propertyName}". Please review and approve.`,
              type: "approval" as const,
              entityType: "property",
              entityId: input.propertyId,
            }));
            await tx.insert(notifications).values(notificationValues);
          }

          await tx.insert(approvalHistory).values({
            propertyId: input.propertyId,
            step: 2,
            action: "submitted",
            adminId: userId,
            comments: "Agreement and initial payment submitted",
          });
        }

        return { success: true };
      });
    }),

  submitStep3: staffQuery
    .input(
      z.object({
        propertyId: z.number(),
        gewogCertification: z.string().optional(),
        internalAgreement: z.string().optional(),
        occupancyCertificate: z.string().optional(),
        plrVerification: z.string().optional(),
        remainingPaymentScreenshot: z.string().optional(),
        remainingPaymentAmount: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name;
      const isAdmin = ctx.unifiedUser!.role === "admin";

      // Validate remaining payment amount if provided
      if (input.remainingPaymentAmount !== undefined && input.remainingPaymentAmount.trim() !== "") {
        const rpa = parseFloat(input.remainingPaymentAmount);
        if (isNaN(rpa) || rpa < 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Remaining payment amount must be a valid non-negative number." });
        }
      }

      const { propertyId, ...values } = input;

      return await db.transaction(async (tx) => {
        const prop = await tx.select().from(properties).where(eq(properties.id, input.propertyId)).limit(1);
        if (prop.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });

        const propertyType = await tx.select({ requiresBuildingDocs: propertyTypes.requiresBuildingDocs })
          .from(propertyTypes)
          .where(eq(propertyTypes.id, prop[0].propertyTypeId))
          .limit(1);

        const requiresBuildingDocs = propertyType[0]?.requiresBuildingDocs ?? false;

        if (requiresBuildingDocs) {
          const buildingDocs = ["gewogCertification", "internalAgreement", "occupancyCertificate", "plrVerification"];
          const missingDocs = buildingDocs.filter(doc => !input[doc as keyof typeof input]);

          if (missingDocs.length > 0) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `The following documents are required for this property type: ${missingDocs.map(d => d.replace(/([A-Z])/g, ' $1').trim()).join(", ")}. Please upload all required documents.` });
          }
        }

        if (!input.remainingPaymentScreenshot) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Remaining payment screenshot is required. Please upload the payment proof." });
        }
        if (!input.remainingPaymentAmount || input.remainingPaymentAmount.trim() === "") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Remaining payment amount is required. Please enter the amount." });
        }

        // Step 2 must be approved before staff can work on Step 3
        if (!isAdmin && prop[0].currentStep < 3) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Step 2 (Agreement & Payment) must be approved by admin before proceeding to Step 3. Please wait for admin approval." });
        }

        // Block resubmission while Step 3 is pending admin review
        if (!isAdmin && prop[0].approvalStatus === "pending_review" && prop[0].currentStep === 3) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Step 3 is already submitted and waiting for admin approval. Please wait for approval before resubmitting." });
        }
        const existing = await tx.select().from(propertyDocuments)
          .where(eq(propertyDocuments.propertyId, propertyId))
          .limit(1);

        if (existing.length > 0) {
          await tx.update(propertyDocuments)
            .set({
              ...values,
              approvalStatus: isAdmin ? "approved" : "pending",
              comments: null,
              ...(isAdmin ? { approvedBy: userId, approvedAt: new Date() } : {}),
            })
            .where(eq(propertyDocuments.propertyId, propertyId));
        } else {
          await tx.insert(propertyDocuments).values({
            propertyId,
            ...values,
            uploadedBy: userId,
            approvalStatus: isAdmin ? "approved" : "pending",
            ...(isAdmin ? { approvedBy: userId, approvedAt: new Date() } : {}),
          });
        }

        await tx.update(properties)
          .set({
            currentStep: isAdmin ? 4 : 3,
            approvalStatus: isAdmin ? "approved" : "pending_review",
          })
          .where(eq(properties.id, propertyId));

        if (isAdmin) {
          await tx.insert(approvalHistory).values({
            propertyId,
            step: 3,
            action: "approved",
            adminId: userId,
            comments: "Auto-approved by admin",
          });

          if (prop[0].listedById !== userId) {
            await tx.insert(notifications).values({
              userId: prop[0].listedById,
              title: "Step 3 Auto-Approved",
              message: `Step 3 (Property Documents) for "${prop[0].propertyName}" has been auto-approved by admin.`,
              type: "success",
              entityType: "property",
              entityId: propertyId,
            });
          }
        } else {
          const admins = await tx.select({ id: localUsers.id }).from(localUsers).where(eq(localUsers.role, "admin"));
          if (admins.length > 0) {
            const notificationValues = admins.map(admin => ({
              userId: admin.id,
              title: "Step 3 Pending Approval",
              message: `${userName} submitted Property Documents for "${prop[0].propertyName}". Please review and approve.`,
              type: "approval" as const,
              entityType: "property",
              entityId: propertyId,
            }));
            await tx.insert(notifications).values(notificationValues);
          }

          await tx.insert(approvalHistory).values({
            propertyId,
            step: 3,
            action: "submitted",
            adminId: userId,
            comments: requiresBuildingDocs ? "Property documents (building type) submitted for review" : "Property documents (land type) submitted for review",
          });
        }

        return { success: true };
      });
    }),

  submitStep4: staffQuery
    .input(
      z.object({
        propertyId: z.number(),
        lagthramStatus: z.enum(["pending", "processing", "completed"]),
        loanStatus: z.enum(["pending", "processing", "completed"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name;
      const isAdmin = ctx.unifiedUser!.role === "admin";

      const values = {
        lagthramStatus: input.lagthramStatus,
        loanStatus: input.loanStatus,
      };

      if (input.lagthramStatus === "completed") values.lagthramCompletedAt = new Date();
      if (input.loanStatus === "completed") values.loanCompletedAt = new Date();

      const isBothCompleted = input.lagthramStatus === "completed" && input.loanStatus === "completed";

      return await db.transaction(async (tx) => {
        const prop = await tx.select().from(properties).where(eq(properties.id, input.propertyId)).limit(1);
        if (prop.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });

        // Step 3 must be approved before staff can work on Step 4
        if (!isAdmin && prop[0].currentStep < 4) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Step 3 (Property Documents) must be approved by admin before proceeding to Step 4. Please wait for admin approval." });
        }

        // Block resubmission while Step 4 is pending admin review
        if (!isAdmin && prop[0].approvalStatus === "pending_review" && prop[0].currentStep === 4) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Step 4 is already submitted and waiting for admin approval. Please wait for approval before resubmitting." });
        }
        const existing = await tx.select().from(verificationProcesses)
          .where(eq(verificationProcesses.propertyId, input.propertyId))
          .limit(1);

        if (existing.length > 0) {
          await tx.update(verificationProcesses)
            .set(values)
            .where(eq(verificationProcesses.propertyId, input.propertyId));
        } else {
          await tx.insert(verificationProcesses).values({
            propertyId: input.propertyId,
            ...values,
          });
        }

        // ONLY trigger approval when BOTH are completed
        if (isBothCompleted) {
          if (isAdmin) {
            await tx.update(verificationProcesses)
              .set({ approvedBy: userId, approvedAt: new Date() })
              .where(eq(verificationProcesses.propertyId, input.propertyId));

            await tx.update(properties)
              .set({ currentStep: 5, approvalStatus: "approved", updatedAt: new Date() })
              .where(eq(properties.id, input.propertyId));

            await tx.insert(approvalHistory).values({
              propertyId: input.propertyId,
              step: 4,
              action: "approved",
              adminId: userId,
              comments: "Auto-approved by admin",
            });

            if (prop[0].listedById !== userId) {
              await tx.insert(notifications).values({
                userId: prop[0].listedById,
                title: "Step 4 Auto-Approved",
                message: `Step 4 (Verification Process) for "${prop[0].propertyName}" has been auto-approved by admin.`,
                type: "success",
                entityType: "property",
                entityId: input.propertyId,
              });
            }
          } else {
            await tx.update(properties)
              .set({ currentStep: 4, approvalStatus: "pending_review", updatedAt: new Date() })
              .where(eq(properties.id, input.propertyId));

            const admins = await tx.select({ id: localUsers.id }).from(localUsers).where(eq(localUsers.role, "admin"));
            if (admins.length > 0) {
              const notificationValues = admins.map(admin => ({
                userId: admin.id,
                title: "Step 4 Verification Ready",
                message: `${userName} completed all verifications for "${prop[0].propertyName}". Please review and finalize Step 4.`,
                type: "approval" as const,
                entityType: "property",
                entityId: input.propertyId,
              }));
              await tx.insert(notifications).values(notificationValues);
            }

            await tx.insert(approvalHistory).values({
              propertyId: input.propertyId,
              step: 4,
              action: "submitted",
              adminId: userId,
              comments: "Verification completed. Waiting for admin approval to finalize Step 4.",
            });
          }
        } else {
          // Just a progress update
          await tx.insert(approvalHistory).values({
            propertyId: input.propertyId,
            step: 4,
            action: "resubmitted",
            adminId: userId,
            comments: `Progress update - Lagthram: ${input.lagthramStatus}, Loan: ${input.loanStatus}.`,
          });
        }

        return { success: true };
      });
    }),

  submitStep5: staffQuery
    .input(
      z.object({
        propertyId: z.number(),
        finalDocument: z.string().min(1, "Final document is required"),
        completionCertificate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name;
      const isAdmin = ctx.unifiedUser!.role === "admin";

      const values = {
        finalDocument: input.finalDocument,
        completionCertificate: input.completionCertificate,
        approvalStatus: isAdmin ? "approved" as const : "pending" as const,
      };

      return await db.transaction(async (tx) => {
        const prop = await tx.select().from(properties).where(eq(properties.id, input.propertyId)).limit(1);
        if (prop.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });

        if (!input.finalDocument) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Final Lagthram Document is required. Please upload the document." });
        }

        // Step 4 must be approved before staff can work on Step 5
        if (!isAdmin && prop[0].currentStep < 5) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Step 4 (Verification Process) must be approved by admin before proceeding to Step 5. Please wait for admin approval." });
        }

        // Block resubmission while Step 5 is pending admin review
        if (!isAdmin && prop[0].approvalStatus === "pending_review" && prop[0].currentStep === 5) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Step 5 is already submitted and waiting for admin approval. Please wait for approval before resubmitting." });
        }

        // Require verification process was approved by admin
        const verification = await tx.select().from(verificationProcesses)
          .where(eq(verificationProcesses.propertyId, input.propertyId))
          .limit(1);

        const canProceedToStep5 = verification[0] && verification[0].approvedAt !== null;
        if (!isAdmin && !canProceedToStep5) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Step 4 (Verification Process) must be approved by admin before proceeding to Step 5. Please wait for admin approval." });
        }
        const existing = await tx.select().from(finalLagthrams)
          .where(eq(finalLagthrams.propertyId, input.propertyId))
          .limit(1);

        if (existing.length > 0) {
          await tx.update(finalLagthrams)
            .set({
              ...values,
              comments: null,
              ...(isAdmin ? { approvedBy: userId, approvedAt: new Date() } : {}),
            })
            .where(eq(finalLagthrams.propertyId, input.propertyId));
        } else {
          await tx.insert(finalLagthrams).values({
            propertyId: input.propertyId,
            ...values,
            ...(isAdmin ? { approvedBy: userId, approvedAt: new Date() } : {}),
          });
        }

        if (isAdmin) {
          await tx.update(properties)
            .set({
              currentStep: 5,
              approvalStatus: "completed",
              workflowStatus: "completed",
              isSold: true,
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(properties.id, input.propertyId));

          await tx.insert(approvalHistory).values({
            propertyId: input.propertyId,
            step: 5,
            action: "approved",
            adminId: userId,
            comments: "Auto-approved by admin. Property completed.",
          });

          if (prop[0].listedById !== userId) {
            await tx.insert(notifications).values({
              userId: prop[0].listedById,
              title: "Property Completed",
              message: `"${prop[0].propertyName}" has been auto-approved and completed by admin.`,
              type: "success",
              entityType: "property",
              entityId: input.propertyId,
            });
          }
        } else {
          await tx.update(properties)
            .set({ currentStep: 5, approvalStatus: "pending_review" })
            .where(eq(properties.id, input.propertyId));

          const admins = await tx.select({ id: localUsers.id }).from(localUsers).where(eq(localUsers.role, "admin"));
          if (admins.length > 0) {
            const notificationValues = admins.map(admin => ({
              userId: admin.id,
              title: "Step 5 Pending Approval",
              message: `${userName} submitted Final Lagthram for "${prop[0].propertyName}". Please review and approve for final completion.`,
              type: "approval" as const,
              entityType: "property",
              entityId: input.propertyId,
            }));
            await tx.insert(notifications).values(notificationValues);
          }

          await tx.insert(approvalHistory).values({
            propertyId: input.propertyId,
            step: 5,
            action: "submitted",
            adminId: userId,
            comments: "Final lagthram and completion documents submitted",
          });
        }

        return { success: true };
      });
    }),

  getFullWorkflow: staffQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const userRole = ctx.unifiedUser!.role;

      const property = await db
        .select({
          id: properties.id,
          propertyName: properties.propertyName,
          propertyTypeId: properties.propertyTypeId,
          address: properties.address,
          latitude: properties.latitude,
          longitude: properties.longitude,
          ownerName: properties.ownerName,
          ownerCID: properties.ownerCID,
          ownerPhone: properties.ownerPhone,
          ownerAddress: properties.ownerAddress,
          buyerName: properties.buyerName,
          buyerCID: properties.buyerCID,
          buyerPhone: properties.buyerPhone,
          buyerAddress: properties.buyerAddress,
          sellingPrice: properties.sellingPrice,
          realEstateFee: properties.realEstateFee,
          pricePerDecimal: properties.pricePerDecimal,
          landSizeDecimal: properties.landSizeDecimal,
          negotiatedPrice: properties.negotiatedPrice,
          discountAmount: properties.discountAmount,
          finalSellingPrice: properties.finalSellingPrice,
          priceOverrideBy: properties.priceOverrideBy,
          priceOverrideAt: properties.priceOverrideAt,
          priceOverrideReason: properties.priceOverrideReason,
          thramNumber: properties.thramNumber,
          plotNumber: properties.plotNumber,
          currentStep: properties.currentStep,
          approvalStatus: properties.approvalStatus,
          workflowStatus: properties.workflowStatus,
          listedById: properties.listedById,
          noObjectionLetter: properties.noObjectionLetter,
          adminNotes: properties.adminNotes,
          rejectionComments: properties.rejectionComments,
          completedAt: properties.completedAt,
          isSold: properties.isSold,
          features: properties.features,
          createdAt: properties.createdAt,
          updatedAt: properties.updatedAt,
          propertyTypeName: propertyTypes.name,
          requiresBuildingDocs: propertyTypes.requiresBuildingDocs,
        })
        .from(properties)
        .leftJoin(propertyTypes, eq(properties.propertyTypeId, propertyTypes.id))
        .where(eq(properties.id, input.id))
        .limit(1);

      if (property.length === 0) return null;

      // Staff can only see their own properties, admin can see all
      if (userRole === "staff" && property[0].listedById !== ctx.unifiedUser!.id) {
        return null;
      }

      const agreement = await db.select().from(propertyAgreements)
        .where(eq(propertyAgreements.propertyId, input.id))
        .limit(1);

      const documents = await db.select().from(propertyDocuments)
        .where(eq(propertyDocuments.propertyId, input.id))
        .limit(1);

      const verification = await db.select().from(verificationProcesses)
        .where(eq(verificationProcesses.propertyId, input.id))
        .limit(1);

      const finalLagthram = await db.select().from(finalLagthrams)
        .where(eq(finalLagthrams.propertyId, input.id))
        .limit(1);

      const images = await db.select().from(propertyImages)
        .where(eq(propertyImages.propertyId, input.id));

      const history = await db.select()
        .from(approvalHistory)
        .where(eq(approvalHistory.propertyId, input.id))
        .orderBy(approvalHistory.createdAt);

      const priceHistory = await db.select()
        .from(propertyPriceHistory)
        .where(eq(propertyPriceHistory.propertyId, input.id))
        .orderBy(desc(propertyPriceHistory.createdAt));

      return {
        property: property[0],
        agreement: agreement[0] || null,
        documents: documents[0] || null,
        verification: verification[0] || null,
        finalLagthram: finalLagthram[0] || null,
        images,
        history,
        priceHistory,
      };
    }),

  getAllDocuments: staffQuery
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();

      // Verify ownership for staff
      if (ctx.unifiedUser!.role === "staff") {
        const prop = await db.select({ listedById: properties.listedById })
          .from(properties)
          .where(eq(properties.id, input.propertyId))
          .limit(1);
        if (prop.length === 0 || prop[0].listedById !== ctx.unifiedUser!.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
        }
      }

      const agreement = await db.select().from(propertyAgreements).where(eq(propertyAgreements.propertyId, input.propertyId)).limit(1);
      const docs = await db.select().from(propertyDocuments).where(eq(propertyDocuments.propertyId, input.propertyId)).limit(1);
      const final = await db.select().from(finalLagthrams).where(eq(finalLagthrams.propertyId, input.propertyId)).limit(1);

      const allFiles: { name: string; url: string; type: string }[] = [];

      if (agreement[0]) {
        if (agreement[0].agreementFile) allFiles.push({ name: "Agreement", url: agreement[0].agreementFile, type: "Legal" });
        if (agreement[0].paymentScreenshot) allFiles.push({ name: "Initial Payment Receipt", url: agreement[0].paymentScreenshot, type: "Payment" });
      }

      if (docs[0]) {
        if (docs[0].gewogCertification) allFiles.push({ name: "Gewog Endorse Document", url: docs[0].gewogCertification, type: "Verification" });
        if (docs[0].internalAgreement) allFiles.push({ name: "Internal Agreement", url: docs[0].internalAgreement, type: "Legal" });
        if (docs[0].occupancyCertificate) allFiles.push({ name: "Occupancy Certificate", url: docs[0].occupancyCertificate, type: "Verification" });
        if (docs[0].plrVerification) allFiles.push({ name: "PLR Verification", url: docs[0].plrVerification, type: "Verification" });
        if (docs[0].remainingPaymentScreenshot) allFiles.push({ name: "Final Payment Receipt", url: docs[0].remainingPaymentScreenshot, type: "Payment" });
      }

      if (final[0]) {
        if (final[0].finalDocument) allFiles.push({ name: "Final Lagthram", url: final[0].finalDocument, type: "Completion" });
        if (final[0].completionCertificate) allFiles.push({ name: "Completion Certificate", url: final[0].completionCertificate, type: "Completion" });
      }

      return allFiles;
    }),

  approveStep: adminQuery
    .input(
      z.object({
        propertyId: z.number(),
        step: z.number().min(1).max(5),
        comments: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const adminId = ctx.unifiedUser!.id;
      const now = new Date();

      const propCheck = await db.select({ currentStep: properties.currentStep })
        .from(properties)
        .where(eq(properties.id, input.propertyId))
        .limit(1);

      if (propCheck.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      if (propCheck[0].currentStep !== input.step) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot approve step ${input.step}: property is currently at step ${propCheck[0].currentStep}`,
        });
      }

      return await db.transaction(async (tx) => {
        switch (input.step) {
          case 1:
            await tx.update(properties)
              .set({ approvalStatus: "approved", currentStep: 2, workflowStatus: "processing", updatedAt: now })
              .where(eq(properties.id, input.propertyId));
            break;
          case 2:
            await tx.update(propertyAgreements)
              .set({ approvalStatus: "approved", approvedBy: adminId, approvedAt: now })
              .where(eq(propertyAgreements.propertyId, input.propertyId));
            await tx.update(properties)
              .set({ currentStep: 3, approvalStatus: "approved", updatedAt: now })
              .where(eq(properties.id, input.propertyId));
            break;
          case 3:
            await tx.update(propertyDocuments)
              .set({ approvalStatus: "approved", approvedBy: adminId, approvedAt: now })
              .where(eq(propertyDocuments.propertyId, input.propertyId));
            await tx.update(properties)
              .set({ currentStep: 4, approvalStatus: "approved", updatedAt: now })
              .where(eq(properties.id, input.propertyId));
            break;
          case 4:
            const existingVerification = await tx.select().from(verificationProcesses)
              .where(eq(verificationProcesses.propertyId, input.propertyId))
              .limit(1);

            if (existingVerification.length > 0) {
              await tx.update(verificationProcesses)
                .set({ approvedBy: adminId, approvedAt: now })
                .where(eq(verificationProcesses.propertyId, input.propertyId));
            }

            await tx.update(properties)
              .set({ currentStep: 5, approvalStatus: "approved", updatedAt: now })
              .where(eq(properties.id, input.propertyId));
            break;
          case 5:
            await tx.update(finalLagthrams)
              .set({ approvalStatus: "approved", approvedBy: adminId, approvedAt: now })
              .where(eq(finalLagthrams.propertyId, input.propertyId));
            await tx.update(properties)
              .set({
                currentStep: 5,
                approvalStatus: "completed",
                workflowStatus: "completed",
                isSold: true,
                completedAt: now,
                updatedAt: now,
              })
              .where(eq(properties.id, input.propertyId));
            break;
        }

        await tx.insert(approvalHistory).values({
          propertyId: input.propertyId,
          step: input.step,
          action: "approved",
          adminId,
          comments: input.comments || `Step ${input.step} approved`,
        });

        const prop = await tx.select({ listedById: properties.listedById, propertyName: properties.propertyName })
          .from(properties)
          .where(eq(properties.id, input.propertyId))
          .limit(1);

        if (prop.length > 0) {
          await tx.insert(notifications).values({
            userId: prop[0].listedById,
            title: `Step ${input.step} Approved`,
            message: `Your property "${prop[0].propertyName}" - Step ${input.step} has been approved.${input.comments ? ` Comments: ${input.comments}` : ""}`,
            type: "success",
            entityType: "property",
            entityId: input.propertyId,
          });
        }

        return { success: true };
      });
    }),

  rejectStep: adminQuery
    .input(
      z.object({
        propertyId: z.number(),
        step: z.number().min(1).max(5),
        comments: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const adminId = ctx.unifiedUser!.id;
      const now = new Date();

      const propCheck = await db.select({ currentStep: properties.currentStep })
        .from(properties)
        .where(eq(properties.id, input.propertyId))
        .limit(1);

      if (propCheck.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      if (propCheck[0].currentStep !== input.step) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot reject step ${input.step}: property is currently at step ${propCheck[0].currentStep}`,
        });
      }

      return await db.transaction(async (tx) => {
        switch (input.step) {
          case 1:
            await tx.update(properties)
              .set({ approvalStatus: "rejected", rejectionComments: input.comments, updatedAt: now })
              .where(eq(properties.id, input.propertyId));
            break;
          case 2:
            await tx.update(propertyAgreements)
              .set({ approvalStatus: "rejected", comments: input.comments })
              .where(eq(propertyAgreements.propertyId, input.propertyId));
            await tx.update(properties)
              .set({ approvalStatus: "rejected", rejectionComments: input.comments, updatedAt: now })
              .where(eq(properties.id, input.propertyId));
            break;
          case 3:
            await tx.update(propertyDocuments)
              .set({ approvalStatus: "rejected", comments: input.comments })
              .where(eq(propertyDocuments.propertyId, input.propertyId));
            await tx.update(properties)
              .set({ approvalStatus: "rejected", rejectionComments: input.comments, updatedAt: now })
              .where(eq(properties.id, input.propertyId));
            break;
          case 4:
            const existingVerif = await tx.select().from(verificationProcesses)
              .where(eq(verificationProcesses.propertyId, input.propertyId))
              .limit(1);

            if (existingVerif.length > 0) {
              await tx.update(verificationProcesses)
                .set({ comments: input.comments })
                .where(eq(verificationProcesses.propertyId, input.propertyId));
            }
            // Do NOT create a phantom verification record on rejection

            await tx.update(properties)
              .set({ approvalStatus: "rejected", rejectionComments: input.comments, updatedAt: now })
              .where(eq(properties.id, input.propertyId));
            break;
          case 5:
            await tx.update(finalLagthrams)
              .set({ approvalStatus: "rejected", comments: input.comments })
              .where(eq(finalLagthrams.propertyId, input.propertyId));
            await tx.update(properties)
              .set({ approvalStatus: "rejected", rejectionComments: input.comments, updatedAt: now })
              .where(eq(properties.id, input.propertyId));
            break;
        }

        await tx.insert(approvalHistory).values({
          propertyId: input.propertyId,
          step: input.step,
          action: "rejected",
          adminId,
          comments: input.comments,
        });

        const prop = await tx.select({ listedById: properties.listedById, propertyName: properties.propertyName })
          .from(properties)
          .where(eq(properties.id, input.propertyId))
          .limit(1);

        if (prop.length > 0) {
          await tx.insert(notifications).values({
            userId: prop[0].listedById,
            title: `Step ${input.step} Rejected`,
            message: `Your property "${prop[0].propertyName}" - Step ${input.step} has been rejected. Reason: ${input.comments}`,
            type: "warning",
            entityType: "property",
            entityId: input.propertyId,
          });
        }

        return { success: true };
      });
    }),

  pendingApprovals: adminQuery.query(async ({ ctx }) => {
    const db = getDb();

    // Get all properties that need approval (not approved, not completed, not draft)
    // Exclude properties listed by admin since admin actions auto-approve
    const pendingProperties = await db
      .select({
        id: properties.id,
        propertyName: properties.propertyName,
        propertyTypeName: propertyTypes.name,
        ownerName: properties.ownerName,
        ownerCID: properties.ownerCID,
        ownerPhone: properties.ownerPhone,
        ownerAddress: properties.ownerAddress,
        buyerName: properties.buyerName,
        buyerCID: properties.buyerCID,
        buyerPhone: properties.buyerPhone,
        sellingPrice: properties.sellingPrice,
        realEstateFee: properties.realEstateFee,
        address: properties.address,
        latitude: properties.latitude,
        longitude: properties.longitude,
        currentStep: properties.currentStep,
        approvalStatus: properties.approvalStatus,
        workflowStatus: properties.workflowStatus,
        listedByName: localUsers.fullName,
        listedById: properties.listedById,
        noObjectionLetter: properties.noObjectionLetter,
        rejectionComments: properties.rejectionComments,
        adminNotes: properties.adminNotes,
        createdAt: properties.createdAt,
        updatedAt: properties.updatedAt,
      })
      .from(properties)
      .leftJoin(propertyTypes, eq(properties.propertyTypeId, propertyTypes.id))
      .leftJoin(localUsers, eq(properties.listedById, localUsers.id))
      .where(
        and(
          ne(properties.approvalStatus, "completed"),
          ne(properties.workflowStatus, "completed"),
          or(
            eq(properties.approvalStatus, "submitted"),
            eq(properties.approvalStatus, "pending_review")
          ),
          eq(localUsers.role, "staff")
        )
      )
      .orderBy(desc(properties.updatedAt));

    return pendingProperties;
  }),

  dashboardStats: adminQuery.query(async () => {
    const db = getDb();

    const totalProperties = await db.select({ count: count() }).from(properties);
    const pendingCount = await db.select({ count: count() })
      .from(properties)
      .where(or(eq(properties.approvalStatus, "submitted"), eq(properties.approvalStatus, "pending_review")));
    const approvedCount = await db.select({ count: count() })
      .from(properties)
      .where(eq(properties.workflowStatus, "completed"));
    const rejectedCount = await db.select({ count: count() })
      .from(properties)
      .where(eq(properties.approvalStatus, "rejected"));
    const totalRevenue = await db
      .select({ total: sql<string>`COALESCE(CAST(SUM(${properties.realEstateFee}) AS DECIMAL), 0)` })
      .from(properties)
      .where(eq(properties.workflowStatus, "completed"));
    // Note: realEstateFee is already calculated as 3% of finalSellingPrice, so revenue is correct

    return {
      totalProperties: totalProperties[0]?.count || 0,
      pendingApprovals: pendingCount[0]?.count || 0,
      completedSales: approvedCount[0]?.count || 0,
      rejectedCount: rejectedCount[0]?.count || 0,
      totalRevenue: totalRevenue[0]?.total || "0",
    };
  }),

  staffDashboardStats: staffQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.unifiedUser!.id;

    const totalProperties = await db.select({ count: count() })
      .from(properties)
      .where(eq(properties.listedById, userId));
    const pendingCount = await db.select({ count: count() })
      .from(properties)
      .where(and(eq(properties.listedById, userId), or(eq(properties.approvalStatus, "submitted"), eq(properties.approvalStatus, "pending_review"))));
    const rejectedCount = await db.select({ count: count() })
      .from(properties)
      .where(and(eq(properties.listedById, userId), eq(properties.approvalStatus, "rejected")));
    const completedCount = await db.select({ count: count() })
      .from(properties)
      .where(and(eq(properties.listedById, userId), eq(properties.workflowStatus, "completed")));

    return {
      totalProperties: totalProperties[0]?.count || 0,
      pendingApprovals: pendingCount[0]?.count || 0,
      rejectedCount: rejectedCount[0]?.count || 0,
      completedSales: completedCount[0]?.count || 0,
    };
  }),

  generateCertificate: staffQuery
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();

      const prop = await db
        .select({
          id: properties.id,
          propertyName: properties.propertyName,
          propertyTypeId: properties.propertyTypeId,
          address: properties.address,
          ownerName: properties.ownerName,
          ownerCID: properties.ownerCID,
          sellingPrice: properties.sellingPrice,
          realEstateFee: properties.realEstateFee,
          finalSellingPrice: properties.finalSellingPrice,
          listedById: properties.listedById,
          completedAt: properties.completedAt,
          workflowStatus: properties.workflowStatus,
          propertyTypeName: propertyTypes.name,
        })
        .from(properties)
        .leftJoin(propertyTypes, eq(properties.propertyTypeId, propertyTypes.id))
        .where(eq(properties.id, input.propertyId))
        .limit(1);

      if (prop.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      const property = prop[0];

      if (ctx.unifiedUser!.role === "staff" && property.listedById !== ctx.unifiedUser!.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }

      if (property.workflowStatus !== "completed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Property workflow is not completed yet" });
      }

      const listedBy = await db.select({ fullName: localUsers.fullName })
        .from(localUsers)
        .where(eq(localUsers.id, property.listedById))
        .limit(1);

      const { generateCertificatePdfBase64 } = await import("./services/certificate");

      const certificateData = {
        propertyName: property.propertyName,
        propertyType: property.propertyTypeName || "Unknown",
        address: property.address,
        ownerName: property.ownerName,
        ownerCID: property.ownerCID,
        sellingPrice: property.sellingPrice,
        finalSellingPrice: property.finalSellingPrice,
        realEstateFee: property.realEstateFee,
        listedByName: listedBy[0]?.fullName || "Unknown",
        completedAt: property.completedAt || new Date(),
        propertyId: property.id,
      };

      const pdfBase64 = generateCertificatePdfBase64(certificateData);

      return { certificateUrl: pdfBase64 };
    }),

  getBillingList: staffQuery
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).default(20),
      }).default(() => ({ page: 1, limit: 20 }))
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const userRole = ctx.unifiedUser!.role;
      const userId = ctx.unifiedUser!.id;

      const conditions = [];

      // Staff can only see their own properties
      if (userRole === "staff") {
        conditions.push(eq(properties.listedById, userId));
      }

      const escapedSearch = input.search?.replace(/[%_]/g, "\\$&");
      if (escapedSearch) {
        conditions.push(
          or(
            like(properties.propertyName, `%${escapedSearch}%`),
            like(properties.ownerName, `%${escapedSearch}%`),
            like(properties.buyerName, `%${escapedSearch}%`)
          )
        );
      }

      if (input.status) {
        conditions.push(eq(properties.workflowStatus, input.status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const page = input.page || 1;
      const limit = input.limit || 20;
      const offset = (page - 1) * limit;

      const totalResult = await db.select({ count: count() }).from(properties).where(whereClause);
      const total = totalResult[0]?.count || 0;

      const results = await db
        .select({
          id: properties.id,
          propertyName: properties.propertyName,
          ownerName: properties.ownerName,
          buyerName: properties.buyerName,
          sellingPrice: properties.sellingPrice,
          realEstateFee: properties.realEstateFee,
          finalSellingPrice: properties.finalSellingPrice,
          negotiatedPrice: properties.negotiatedPrice,
          discountAmount: properties.discountAmount,
          currentStep: properties.currentStep,
          approvalStatus: properties.approvalStatus,
          workflowStatus: properties.workflowStatus,
          createdAt: properties.createdAt,
          completedAt: properties.completedAt,
          propertyTypeName: propertyTypes.name,
          listedByName: localUsers.fullName,
          // Agreement fields
          commissionAmount: propertyAgreements.commissionAmount,
          paymentAmount: propertyAgreements.paymentAmount,
          agreementFile: propertyAgreements.agreementFile,
          paymentScreenshot: propertyAgreements.paymentScreenshot,
          // Document fields
          remainingPaymentScreenshot: propertyDocuments.remainingPaymentScreenshot,
          remainingPaymentAmount: propertyDocuments.remainingPaymentAmount,
        })
        .from(properties)
        .leftJoin(propertyTypes, eq(properties.propertyTypeId, propertyTypes.id))
        .leftJoin(localUsers, eq(properties.listedById, localUsers.id))
        .leftJoin(propertyAgreements, eq(propertyAgreements.propertyId, properties.id))
        .leftJoin(propertyDocuments, eq(propertyDocuments.propertyId, properties.id))
        .where(whereClause)
        .orderBy(desc(properties.createdAt))
        .limit(limit)
        .offset(offset);

      // Financial totals across all matching records (not just current page)
      // Use finalSellingPrice when available, otherwise fall back to sellingPrice
      const totalsResult = await db.select({
        totalSellingPrice: sql<string>`COALESCE(CAST(SUM(COALESCE(${properties.finalSellingPrice}, ${properties.sellingPrice})) AS DECIMAL), 0)`,
        totalCommission: sql<string>`COALESCE(SUM(COALESCE(CAST(${propertyAgreements.commissionAmount} AS DECIMAL), CAST(${properties.realEstateFee} AS DECIMAL), 0)), 0)`,
        totalPaymentAmount: sql<string>`COALESCE(SUM(
          CASE
            WHEN ${properties.currentStep} >= 3 THEN
              CASE
                WHEN ${propertyAgreements.paymentAmount} IS NOT NULL THEN ${propertyAgreements.paymentAmount}
                ELSE COALESCE(${properties.finalSellingPrice}, ${properties.sellingPrice}, 0) / 2
              END
            ELSE 0
          END
          +
          CASE
            WHEN ${properties.currentStep} >= 4 THEN COALESCE(${propertyDocuments.remainingPaymentAmount}, 0)
            ELSE 0
          END
        ), 0)`,
        totalRemainingDue: sql<string>`COALESCE(SUM(
          GREATEST(
            COALESCE(${properties.finalSellingPrice}, ${properties.sellingPrice}, 0)
            -
            CASE
              WHEN ${properties.currentStep} >= 3 THEN
                CASE
                  WHEN ${propertyAgreements.paymentAmount} IS NOT NULL THEN ${propertyAgreements.paymentAmount}
                  ELSE COALESCE(${properties.finalSellingPrice}, ${properties.sellingPrice}, 0) / 2
                END
              ELSE 0
            END
            -
            CASE
              WHEN ${properties.currentStep} >= 4 THEN COALESCE(${propertyDocuments.remainingPaymentAmount}, 0)
              ELSE 0
            END,
            0
          )
        ), 0)`,
      })
        .from(properties)
        .leftJoin(propertyAgreements, eq(propertyAgreements.propertyId, properties.id))
        .leftJoin(propertyDocuments, eq(propertyDocuments.propertyId, properties.id))
        .where(whereClause);

      const totals = totalsResult[0] ?? { totalSellingPrice: "0", totalCommission: "0", totalPaymentAmount: "0", totalRemainingDue: "0" };

      return { items: results, total, page, limit, totalPages: Math.ceil(total / limit), totals };
    }),

  exportBilling: staffQuery
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        format: z.enum(["csv", "json", "pdf"]).default("csv"),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const userRole = ctx.unifiedUser!.role;
      const userId = ctx.unifiedUser!.id;

      const conditions = [];

      if (userRole === "staff") {
        conditions.push(eq(properties.listedById, userId));
      }

      const escapedSearch = input?.search?.replace(/[%_]/g, "\\$&");
      if (escapedSearch) {
        conditions.push(
          or(
            like(properties.propertyName, `%${escapedSearch}%`),
            like(properties.ownerName, `%${escapedSearch}%`),
            like(properties.buyerName, `%${escapedSearch}%`)
          )
        );
      }

      if (input?.status) {
        conditions.push(eq(properties.workflowStatus, input.status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const results = await db
        .select({
          id: properties.id,
          propertyName: properties.propertyName,
          ownerName: properties.ownerName,
          buyerName: properties.buyerName,
          sellingPrice: properties.sellingPrice,
          realEstateFee: properties.realEstateFee,
          currentStep: properties.currentStep,
          approvalStatus: properties.approvalStatus,
          workflowStatus: properties.workflowStatus,
          createdAt: properties.createdAt,
          completedAt: properties.completedAt,
          propertyTypeName: propertyTypes.name,
          listedByName: localUsers.fullName,
          commissionAmount: propertyAgreements.commissionAmount,
          paymentAmount: propertyAgreements.paymentAmount,
          remainingPaymentAmount: propertyDocuments.remainingPaymentAmount,
        })
        .from(properties)
        .leftJoin(propertyTypes, eq(properties.propertyTypeId, propertyTypes.id))
        .leftJoin(localUsers, eq(properties.listedById, localUsers.id))
        .leftJoin(propertyAgreements, eq(propertyAgreements.propertyId, properties.id))
        .leftJoin(propertyDocuments, eq(propertyDocuments.propertyId, properties.id))
        .where(whereClause)
        .orderBy(desc(properties.createdAt));

      const formattedData = results.map((item) => {
        // Use finalSellingPrice when available, otherwise fall back to sellingPrice
        const basePrice = parseFloat(item.finalSellingPrice ?? item.sellingPrice ?? "0");
        const hasExactPayment = item.paymentAmount !== null && item.paymentAmount !== undefined;
        const initialPayment = hasExactPayment ? parseFloat(item.paymentAmount || "0") : basePrice / 2;
        const hasExactRemaining = item.remainingPaymentAmount !== null && item.remainingPaymentAmount !== undefined;
        const remainingPayment = hasExactRemaining ? parseFloat(item.remainingPaymentAmount || "0") : Math.max(0, basePrice - initialPayment);
        const commission = parseFloat(item.commissionAmount ?? item.realEstateFee ?? "0");

        const isStep2Approved = item.currentStep >= 3;
        const isStep3Approved = item.currentStep >= 4;

        const initialReceived = isStep2Approved ? initialPayment : 0;
        const remainingReceived = isStep3Approved ? remainingPayment : 0;
        const totalReceived = initialReceived + remainingReceived;
        const balanceDue = Math.max(0, basePrice - totalReceived);
        const netToSeller = Math.max(0, basePrice - commission);

        return {
          id: item.id,
          invoiceNo: `INV-${String(item.id).padStart(5, "0")}`,
          propertyName: item.propertyName,
          ownerName: item.ownerName,
          buyerName: item.buyerName || "",
          propertyType: item.propertyTypeName || "",
          listedBy: item.listedByName || "",
          status: item.workflowStatus,
          sellingPrice: fmtPlain(item.sellingPrice),
          finalSellingPrice: fmtPlain(item.finalSellingPrice),
          initialPayment: fmtPlain(String(initialPayment)),
          remainingPayment: fmtPlain(String(remainingPayment)),
          totalReceived: fmtPlain(String(totalReceived)),
          balanceDue: fmtPlain(String(balanceDue)),
          commission: fmtPlain(String(commission)),
          netToSeller: fmtPlain(String(netToSeller)),
          percentPaid: basePrice > 0 ? Math.round((totalReceived / basePrice) * 100) : 0,
          createdAt: item.createdAt ? format(item.createdAt, "yyyy-MM-dd") : "",
          completedAt: item.completedAt ? format(item.completedAt, "yyyy-MM-dd") : "",
        };
      });

      const exportFormat = input?.format || "csv";

      if (exportFormat === "json") {
        return { data: formattedData };
      }

      if (exportFormat === "pdf") {
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const now = new Date().toLocaleDateString("en-GB");

        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("Billing & Invoices Report", 14, 18);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`Generated on ${now}  •  ${formattedData.length} records`, 14, 25);

        if (input?.search || input?.status) {
          const filters: string[] = [];
          if (input.status) filters.push(`Status: ${input.status}`);
          if (input.search) filters.push(`Search: ${input.search}`);
          doc.text(`Filters: ${filters.join("  |  ")}`, 14, 30);
        }

        autoTable(doc, {
          startY: input?.search || input?.status ? 34 : 30,
          head: [["Invoice #", "Property", "Owner", "Buyer", "Status", "Selling Price", "Total Paid", "Balance Due", "Commission", "Net to Seller"]],
          body: formattedData.map((row) => [
            row.invoiceNo,
            row.propertyName,
            row.ownerName,
            row.buyerName,
            row.status,
            row.sellingPrice,
            row.totalReceived,
            row.balanceDue,
            row.commission,
            row.netToSeller,
          ]),
          headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 9,
          },
          bodyStyles: {
            fontSize: 9,
            textColor: [51, 65, 85],
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          styles: {
            overflow: "linebreak",
            cellPadding: 2,
          },
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: "auto" },
            5: { halign: "right" },
            6: { halign: "right" },
            7: { halign: "right" },
            8: { halign: "right" },
            9: { halign: "right" },
          },
          didDrawPage: (data) => {
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(`Page ${data.pageNumber}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 6, { align: "center" });
          },
        });

        const pdfBase64 = doc.output("datauristring").split(",")[1];
        return { pdfBase64 };
      }

      const headers = ["invoiceNo", "propertyName", "ownerName", "buyerName", "propertyType", "listedBy", "status", "sellingPrice", "initialPayment", "remainingPayment", "totalReceived", "balanceDue", "commission", "netToSeller", "percentPaid", "createdAt", "completedAt"];
      const csv = generateCSV(formattedData, headers);
      return { csv };
    }),
});
