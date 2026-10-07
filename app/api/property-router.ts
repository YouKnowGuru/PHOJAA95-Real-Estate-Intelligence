import { deleteFile } from "./services/upload";
import { z } from "zod";
import { eq, and, like, desc, sql, or, count, ne, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { format } from "date-fns";
import {
  buildBillingExcelBase64,
  buildBillingPdfBase64,
  getExportBranding,
  type BillingExportMeta,
  type BillingExportRow,
  type BillingExportTotals,
} from "./lib/billing-export";
import { createRouter, adminQuery, staffQuery } from "./middleware";
import { isRealEstateStaffRole, assertRealEstateModuleAccess } from "./lib/access-control";
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

// ─── Billing payment expressions ────────────────────────────────────────────
// Shared by getBillingList + exportBilling so the row filters, the KPI totals
// and every export format always agree on what "paid" means for a property.
const billingPriceSql = () =>
  sql<string>`COALESCE(${properties.finalSellingPrice}, ${properties.sellingPrice}, 0)`;

const billingPaidSql = () => {
  const price = billingPriceSql();
  // Legacy split (no "total amount paid" recorded): 50% advance at step 3,
  // remainder at step 4 — exactly what computePayments() does in Billing.tsx.
  const advance = sql`CASE WHEN ${propertyAgreements.paymentAmount} IS NOT NULL THEN ${propertyAgreements.paymentAmount} ELSE ${price} / 2 END`;

  // LEAST(...): a few legacy rows have advance+remainder recorded ABOVE the
  // selling price (data entry), which used to make "received" exceed "billed".
  return sql<string>`LEAST(${price},
  CASE
  WHEN ${propertyAgreements.totalAmountPaid} IS NOT NULL THEN
    CASE WHEN ${properties.currentStep} >= 3 THEN ${propertyAgreements.totalAmountPaid} ELSE 0 END
  ELSE (
    (CASE WHEN ${properties.currentStep} >= 3 THEN ${advance} ELSE 0 END)
    + (CASE WHEN ${properties.currentStep} >= 4 THEN
         CASE WHEN ${propertyDocuments.remainingPaymentAmount} IS NOT NULL
              THEN ${propertyDocuments.remainingPaymentAmount}
              ELSE GREATEST(${price} - ${advance}, 0) END
       ELSE 0 END)
  )
  END)`;
};

/**
 * Maps a billing status filter onto a SQL condition.
 * `pending` / `partial` / `paid` are payment-status filters (what a billing
 * screen needs); every other value falls back to the property workflow status.
 */
function billingStatusCondition(status: string) {
  const price = billingPriceSql();
  const paid = billingPaidSql();

  switch (status) {
    case "pending":
      // Nothing settled yet: payment still outstanding, or workflow not started
      return sql`((NOT (${price} > 0 AND ${paid} >= ${price})) OR (${eq(properties.workflowStatus, "pending")}))`;
    case "partial":
      return sql`(${price} > 0 AND ${paid} > 0 AND ${paid} < ${price})`;
    case "paid":
      return sql`(${price} > 0 AND ${paid} >= ${price})`;
    default:
      return eq(
        properties.workflowStatus,
        status as "approved" | "rejected" | "completed" | "cancelled" | "pending" | "processing"
      );
  }
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
        loanAmount: z.string().optional(),
        pricePerDecimal: z.string().optional(),
        landSizeDecimal: z.string().optional(),
        negotiatedPrice: z.string().optional(),
        discountAmount: z.string().optional(),
        finalSellingPrice: z.string().optional(),
        priceOverrideReason: z.string().max(500).optional(),
        thramNumber: z.string().min(1, "⚠️ Thram Number is required. Please enter the thram number."),
        plotNumber: z.string().min(1, "⚠️ Plot Number is required. Please enter the plot number."),
        yearOfConstruction: z.string().optional(),
        noObjectionLetter: z.string().optional(),
        images: z.array(z.object({
          url: z.string().url().refine((u) => u.startsWith("https://"), { message: "Image URL must use HTTPS" }),
          publicId: z.string().optional()
        })).optional(),
        features: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name;

      // Only real-estate staff (staff/admin) may create properties
      assertRealEstateModuleAccess(ctx.unifiedUser!.role);

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
      if (input.loanAmount !== undefined && input.loanAmount !== "" && (isNaN(parseFloat(input.loanAmount)) || parseFloat(input.loanAmount) < 0)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Loan Amount must be a valid non-negative number." });
      }
      if (!input.thramNumber || input.thramNumber.trim().length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Thram Number is required. Please enter the thram number." });
      }
      if (!input.plotNumber || input.plotNumber.trim().length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Plot Number is required. Please enter the plot number." });
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
          loanAmount: input.loanAmount ? parseFloat(input.loanAmount).toFixed(2) : null,
          pricePerDecimal,
          landSizeDecimal,
          negotiatedPrice,
          discountAmount,
          finalSellingPrice: finalSellingPriceNum,
          priceOverrideBy: isPriceOverride ? userId : null,
          priceOverrideAt: isPriceOverride ? new Date() : null,
          priceOverrideReason: isPriceOverride ? input.priceOverrideReason : null,
          thramNumber: input.thramNumber || null,
          plotNumber: input.plotNumber || null,
          yearOfConstruction: input.yearOfConstruction ? parseInt(input.yearOfConstruction) : null,
          noObjectionLetter: input.noObjectionLetter || null,
          currentStep: 2,
          approvalStatus: "approved",
          workflowStatus: "processing",
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

        await tx.insert(approvalHistory).values({
          propertyId,
          step: 1,
          action: "approved",
          adminId: userId,
          comments: isAdmin ? "Auto-approved by admin" : "Property created and Step 1 auto-approved",
        });

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
        page: z.number().min(1).optional(),
        limit: z.number().min(1).optional(),
      }).optional().default({})
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      assertRealEstateModuleAccess(ctx.unifiedUser!.role);
      const conditions = [];

      // Fast property search: property name prioritized, then other fields.
      // Also supports invoice-number search: "INV-00012", "INV00012", or bare
      // numeric strings like "12" / "00012" are matched against properties.id.
      const rawSearch = input.search?.trim();
      if (rawSearch) {
        // ── Invoice-number shortcut ──────────────────────────────────────
        // Invoice numbers are generated client-side as `INV-${id.padStart(5,"0")}`.
        // Accept all common spellings a user might type:
        //   INV-00012  |  INV00012  |  inv-12  |  00012  |  12
        const invMatch = rawSearch.match(/^(?:INV[-\s]?)?0*(\d+)$/i);
        const invoiceId = invMatch ? parseInt(invMatch[1], 10) : NaN;

        if (!isNaN(invoiceId) && invoiceId > 0) {
          // Direct primary-key lookup — instant, no full-text scan needed
          conditions.push(eq(properties.id, invoiceId));
        } else {
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
      }

      if (input.status) conditions.push(eq(properties.approvalStatus, input.status));
      if (input.workflowStatus) conditions.push(eq(properties.workflowStatus, input.workflowStatus));
      if (input.propertyTypeId) conditions.push(eq(properties.propertyTypeId, input.propertyTypeId));
      if (input.step) conditions.push(eq(properties.currentStep, input.step));

      if (ctx.unifiedUser!.role === "staff") {
        // Staff can view ALL properties (not just their own listings)
      } else if (input.listedById) {
        conditions.push(eq(properties.listedById, input.listedById));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const totalResult = await db.select({ count: count() }).from(properties).where(whereClause);
      const total = totalResult[0]?.count || 0;

      const page = input.page || 1;
      const limit = input.limit;
      const offset = limit ? (page - 1) * limit : 0;

      const baseQuery = db
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
          yearOfConstruction: properties.yearOfConstruction,
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
        .orderBy(desc(properties.createdAt));

      const results = limit
        ? await baseQuery.limit(limit).offset(offset)
        : await baseQuery;

      const propertyIds = results.map(p => p.id);
      const allImages = propertyIds.length > 0
        ? await db.select().from(propertyImages).where(inArray(propertyImages.propertyId, propertyIds))
        : [];

      // Real-estate staff (like admin) work with the full data of all properties —
      // they enter owner/buyer PII themselves and must be able to edit it safely.
      const resultsWithImages = results.map(p => ({
        ...p,
        images: allImages.filter(img => img.propertyId === p.id)
      }));

      return {
        items: resultsWithImages,
        total,
        page,
        limit: limit ?? total,
        totalPages: limit ? Math.ceil(total / limit) : 1
      };
    }),

  getById: staffQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      assertRealEstateModuleAccess(ctx.unifiedUser!.role);

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
          yearOfConstruction: properties.yearOfConstruction,
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

      // Staff can now view ALL properties (read-only access for others' listings)

      const images = await db
        .select()
        .from(propertyImages)
        .where(eq(propertyImages.propertyId, input.id));

      // Real-estate staff (like admin) see the full data of all properties
      const p = property[0];
      return { ...p, images };
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
        priceOverrideReason: z.string().max(500).optional(),
        noObjectionLetter: z.string().optional(),
        adminNotes: z.string().optional(),
        rejectionComments: z.string().optional(),
        thramNumber: z.string().optional(),
        plotNumber: z.string().optional(),
        yearOfConstruction: z.string().optional(),
        images: z.array(z.object({
          url: z.string().url().refine((u) => u.startsWith("https://"), { message: "Image URL must use HTTPS" }),
          publicId: z.string().optional()
        })).optional(),
        features: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, images, adminNotes, rejectionComments, ...data } = input;
      const db = getDb();

      // ── Land Pricing Calculation for Update ───────────────────────────
      function parseDecimalUpd(val: string | undefined, scale: number): string | null {
        if (!val || val.trim() === "") return null;
        const n = parseFloat(val);
        if (isNaN(n) || n < 0) return null;
        return n.toFixed(scale);
      }

      // Capture features JSON before anything else
      const featuresJson = data.features !== undefined
        ? (data.features ? JSON.stringify(data.features) : null)
        : undefined;

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

      // Fetch property type name for building vs land determination
      const targetTypeId = data.propertyTypeId ?? oldProp.propertyTypeId;
      const typeRows = await db.select({ name: propertyTypes.name }).from(propertyTypes).where(eq(propertyTypes.id, targetTypeId)).limit(1);
      const isLand = typeRows[0]?.name === "Land";

      const userId = ctx.unifiedUser!.id;
      const userName = ctx.unifiedUser!.name;
      const isAdmin = ctx.unifiedUser!.role === "admin";
      const isPriceOverride = isAdmin && data.priceOverrideReason && data.priceOverrideReason.trim().length > 0;

      // Calculate new pricing values (falling back to existing if omitted)
      const newPricePerDecimal = data.pricePerDecimal !== undefined
        ? parseDecimalUpd(data.pricePerDecimal, 4)  // scale=4 matches create path
        : oldProp.pricePerDecimal;

      const newLandSizeDecimal = data.landSizeDecimal !== undefined
        ? parseDecimalUpd(data.landSizeDecimal, 4)
        : oldProp.landSizeDecimal;

      const newNegotiatedPrice = data.negotiatedPrice !== undefined
        ? parseDecimalUpd(data.negotiatedPrice, 2)
        : oldProp.negotiatedPrice;

      const newDiscountAmount = data.discountAmount !== undefined
        ? parseDecimalUpd(data.discountAmount, 2)
        : oldProp.discountAmount;

      let sellingPriceNum: string = data.sellingPrice ?? oldProp.sellingPrice ?? "0";
      if (isLand && newPricePerDecimal && newLandSizeDecimal) {
        const p = parseFloat(newPricePerDecimal);
        const l = parseFloat(newLandSizeDecimal);
        if (!isNaN(p) && !isNaN(l) && p > 0 && l > 0) {
          sellingPriceNum = (p * l).toFixed(2);
        }
      }

      let finalSellingPriceNum: string = sellingPriceNum;
      const negNum = newNegotiatedPrice ? parseFloat(newNegotiatedPrice) : 0;
      const discNum = newDiscountAmount ? parseFloat(newDiscountAmount) : 0;
      const spNum = parseFloat(sellingPriceNum);

      if (negNum > 0) {
        finalSellingPriceNum = Math.max(0, negNum - discNum).toFixed(2);
      } else if (discNum > 0) {
        finalSellingPriceNum = Math.max(0, spNum - discNum).toFixed(2);
      }

      let realEstateFeeNum: string = data.realEstateFee ?? oldProp.realEstateFee ?? "0";
      if (isLand) {
        // Land: commission always 3% of the final (discounted) price
        realEstateFeeNum = (parseFloat(finalSellingPriceNum) * 0.03).toFixed(2);
      } else if (data.sellingPrice !== undefined) {
        // Non-land: recalculate from new selling price when it changed
        realEstateFeeNum = (parseFloat(sellingPriceNum) * 0.03).toFixed(2);
      }

      // Update data with computed values
      const updateData: Record<string, unknown> = {};
      if (data.propertyName !== undefined) updateData.propertyName = data.propertyName;
      if (data.propertyTypeId !== undefined) updateData.propertyTypeId = data.propertyTypeId;
      if (data.address !== undefined) updateData.address = data.address;
      if (data.latitude !== undefined) updateData.latitude = data.latitude;
      if (data.longitude !== undefined) updateData.longitude = data.longitude;
      if (data.ownerName !== undefined) updateData.ownerName = data.ownerName;
      if (data.ownerCID !== undefined) updateData.ownerCID = data.ownerCID;
      if (data.ownerPhone !== undefined) updateData.ownerPhone = data.ownerPhone;
      if (data.ownerAddress !== undefined) updateData.ownerAddress = data.ownerAddress;
      if (data.buyerName !== undefined) updateData.buyerName = data.buyerName || null;
      if (data.buyerCID !== undefined) updateData.buyerCID = data.buyerCID || null;
      if (data.buyerPhone !== undefined) updateData.buyerPhone = data.buyerPhone || null;
      if (data.buyerAddress !== undefined) updateData.buyerAddress = data.buyerAddress || null;
      if (sellingPriceNum !== undefined) updateData.sellingPrice = sellingPriceNum;
      if (realEstateFeeNum !== undefined) updateData.realEstateFee = realEstateFeeNum;
      if (data.loanAmount !== undefined) updateData.loanAmount = data.loanAmount ? parseFloat(data.loanAmount).toFixed(2) : null;
      if (newPricePerDecimal !== undefined) updateData.pricePerDecimal = newPricePerDecimal;
      if (newLandSizeDecimal !== undefined) updateData.landSizeDecimal = newLandSizeDecimal;
      if (newNegotiatedPrice !== undefined) updateData.negotiatedPrice = newNegotiatedPrice;
      if (newDiscountAmount !== undefined) updateData.discountAmount = newDiscountAmount;
      if (finalSellingPriceNum !== undefined) updateData.finalSellingPrice = finalSellingPriceNum;
      if (data.thramNumber !== undefined) updateData.thramNumber = data.thramNumber || null;
      if (data.plotNumber !== undefined) updateData.plotNumber = data.plotNumber || null;
      if (data.yearOfConstruction !== undefined) updateData.yearOfConstruction = data.yearOfConstruction ? parseInt(data.yearOfConstruction) : null;
      if (data.noObjectionLetter !== undefined) updateData.noObjectionLetter = data.noObjectionLetter || null;
      if (featuresJson !== undefined) updateData.features = featuresJson;

      if (isPriceOverride) {
        updateData.priceOverrideBy = userId;
        updateData.priceOverrideAt = new Date();
        updateData.priceOverrideReason = input.priceOverrideReason;
      }

      // Validate numeric fields
      if (updateData.sellingPrice !== undefined) {
        const sp = parseFloat(updateData.sellingPrice as string);
        if (isNaN(sp) || sp <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Selling Price must be a valid positive number." });
        }
        updateData.sellingPrice = sp.toFixed(2);
      }
      if (updateData.realEstateFee !== undefined) {
        const fee = parseFloat(updateData.realEstateFee as string);
        if (isNaN(fee) || fee < 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Commission amount must be a valid non-negative number." });
        }
        updateData.realEstateFee = fee.toFixed(2);
      }

      // Ownership check BEFORE any side effects — real-estate staff may edit ANY property;
      // developers and architecture staff may not edit properties at all.
      assertRealEstateModuleAccess(ctx.unifiedUser!.role);
      let staffProp: { listedById: number; approvalStatus: string } | null = null;
      if (ctx.unifiedUser!.role === "staff") {
        staffProp = { listedById: oldProp.listedById, approvalStatus: oldProp.approvalStatus };
      }

      return await db.transaction(async (tx) => {
        // Handle image updates — only delete REMOVED images from Cloudinary.
        //
        // BUG FIX: Previously this deleted EVERY old image from Cloudinary before
        // re-inserting the (possibly identical) incoming list. Re-submitting Step 1
        // of the wizard in edit mode always sends the full image list, so unchanged
        // images were destroyed on Cloudinary while the DB kept pointing at them —
        // the URLs 404'd on every device (only the uploader's browser cache still
        // showed them). Now we only destroy assets whose publicId is NOT present in
        // the incoming images, i.e. images the user actually removed/replaced.
        if (images) {
          const oldImages = await tx.select({ publicId: propertyImages.publicId })
            .from(propertyImages)
            .where(eq(propertyImages.propertyId, id));

          const incomingPublicIds = new Set(
            images.map(img => img.publicId).filter((pid): pid is string => !!pid)
          );
          const removedPublicIds = oldImages
            .map(i => i.publicId)
            .filter((pid): pid is string => !!pid && !incomingPublicIds.has(pid));

          // Delete only removed images from Cloudinary (fire-and-forget, don't block on failure)
          if (removedPublicIds.length > 0) {
            const { deleteCloudinaryImages } = await import("./services/cloudinary");
            await deleteCloudinaryImages(removedPublicIds).catch((err: unknown) =>
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
              .set({ ...updateData, approvalStatus: "submitted", rejectionComments: null })
              .where(eq(properties.id, id));
            return { success: true };
          }

          // Staff cannot modify admin-only fields
          await tx.update(properties).set(updateData).where(eq(properties.id, id));
          return { success: true };
        }

        // Admin update: allow adminNotes and rejectionComments
        const adminUpdateData: Record<string, unknown> = { ...updateData };
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

  updateDates: adminQuery
    .input(
      z.object({
        id: z.number(),
        createdAt: z.string().optional(), // ISO date string "YYYY-MM-DD"
        completedAt: z.string().optional().nullable(), // ISO date string or null to clear
      })
    )
    .mutation(async ({ input }) => {
      const { id, createdAt, completedAt } = input;
      const db = getDb();

      const existing = await db
        .select({ id: properties.id })
        .from(properties)
        .where(eq(properties.id, id))
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      const updateData: Record<string, Date | null | undefined> = {};

      if (createdAt !== undefined) {
        const d = new Date(createdAt);
        if (isNaN(d.getTime())) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid Listed On date" });
        updateData.createdAt = d;
      }

      if (completedAt !== undefined) {
        if (completedAt === null || completedAt === "") {
          updateData.completedAt = null;
        } else {
          const d = new Date(completedAt);
          if (isNaN(d.getTime())) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid Sold On date" });
          updateData.completedAt = d;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return { success: true };
      }

      await db.update(properties).set(updateData).where(eq(properties.id, id));

      return { success: true };
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
        // Property agreement upload moved to Step 3 — optional here so a stored file is never cleared
        agreementFile: z.string().optional(),
        // No longer collected in the wizard; kept optional so the column can be cleared
        paymentScreenshot: z.string().optional(),
        commissionAmount: z.string().optional(),
        // Legacy 50% advance field — kept optional so old clients/records keep working
        paymentAmount: z.string().optional(),
        // Single "Total Amount Paid" collected in Step 2 (replaces the 50% + remaining split)
        totalAmountPaid: z.string().optional(),
      })
    )    .mutation(async ({ input, ctx }) => {      const db = getDb();      const userId = ctx.unifiedUser!.id;      const isAdmin = ctx.unifiedUser!.role === "admin";

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
      if (input.totalAmountPaid !== undefined && input.totalAmountPaid.trim() !== "") {
        const tap = parseFloat(input.totalAmountPaid);
        if (isNaN(tap) || tap < 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Total amount paid must be a valid non-negative number." });
        }
      }

      return await db.transaction(async (tx) => {
        const prop = await tx.select().from(properties).where(eq(properties.id, input.propertyId)).limit(1);
        if (prop.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
        // Real-estate staff can work on any property
        assertRealEstateModuleAccess(ctx.unifiedUser!.role);

        const existing = await tx.select().from(propertyAgreements)
          .where(eq(propertyAgreements.propertyId, input.propertyId))
          .limit(1);

        // Delete old files if being replaced
        if (existing.length > 0) {
          const old = existing[0];
          if (old.agreementFile && input.agreementFile && old.agreementFile !== input.agreementFile) {
            try { await deleteFile(old.agreementFile); } catch { /* ignore */ }
          }
          if (old.paymentScreenshot && old.paymentScreenshot !== input.paymentScreenshot) {
            try { await deleteFile(old.paymentScreenshot); } catch { /* ignore */ }
          }
        }

        const values = {
          agreementFile: input.agreementFile || undefined,
          // Screenshots are no longer collected; clear any previously stored one
          paymentScreenshot: input.paymentScreenshot ?? null,
          commissionAmount: input.commissionAmount,
          paymentAmount: input.paymentAmount,
          totalAmountPaid: input.totalAmountPaid,
          approvalStatus: "approved" as const,
          approvedBy: userId,
          approvedAt: new Date(),
        };

        if (existing.length > 0) {
          await tx.update(propertyAgreements)
            .set({ ...values, comments: null })
            .where(eq(propertyAgreements.propertyId, input.propertyId));
        } else {
          await tx.insert(propertyAgreements).values({
            propertyId: input.propertyId,
            ...values,
          });
        }

        await tx.update(properties)
          .set({
            currentStep: Math.max(prop[0].currentStep, 3),
            approvalStatus: "approved",
            workflowStatus: "processing",
            buyerName: input.buyerName,
            buyerCID: input.buyerCID,
            buyerPhone: input.buyerPhone,
            buyerAddress: input.buyerAddress,
          })
          .where(eq(properties.id, input.propertyId));

        await tx.insert(approvalHistory).values({
          propertyId: input.propertyId,
          step: 2,
          action: "approved",
          adminId: userId,
          comments: isAdmin ? "Auto-approved by admin" : "Step 2 agreement & payment completed",
        });

        return { success: true };
      });
    }),

  submitStep3: staffQuery
    .input(
      z.object({
        propertyId: z.number(),
        gewogCertification: z.string().optional(),
        // Property agreement is uploaded together with the rest of the documents in Step 3
        agreementFile: z.string().optional(),
        internalAgreement: z.string().optional(),
        occupancyCertificate: z.string().optional(),
        plrVerification: z.string().optional(),
        remainingPaymentScreenshot: z.string().optional(),
        // Legacy remaining-amount field — no longer collected in the wizard, kept for old records
        remainingPaymentAmount: z.string().optional(),
      })
    )    .mutation(async ({ input, ctx }) => {      const db = getDb();      const userId = ctx.unifiedUser!.id;      const isAdmin = ctx.unifiedUser!.role === "admin";

      // Validate remaining payment amount if provided
      if (input.remainingPaymentAmount !== undefined && input.remainingPaymentAmount.trim() !== "") {
        const rpa = parseFloat(input.remainingPaymentAmount);
        if (isNaN(rpa) || rpa < 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Remaining payment amount must be a valid non-negative number." });
        }
      }

      const { propertyId, agreementFile, ...values } = input;

      return await db.transaction(async (tx) => {
        const prop = await tx.select().from(properties).where(eq(properties.id, input.propertyId)).limit(1);
        if (prop.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });

        // Authorization: real-estate staff can modify ANY property; other roles cannot
        assertRealEstateModuleAccess(ctx.unifiedUser!.role);

        const propertyType = await tx.select({ requiresBuildingDocs: propertyTypes.requiresBuildingDocs })
          .from(propertyTypes)
          .where(eq(propertyTypes.id, prop[0].propertyTypeId))
          .limit(1);

        const requiresBuildingDocs = propertyType[0]?.requiresBuildingDocs ?? false;

        if (requiresBuildingDocs) {
          const buildingDocs = ["gewogCertification"];
          const missingDocs = buildingDocs.filter(doc => !input[doc as keyof typeof input]);

          if (missingDocs.length > 0) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `The following documents are required for this property type: ${missingDocs.map(d => d.replace(/([A-Z])/g, ' $1').trim()).join(", ")}. Please upload all required documents.` });
          }
        }

        const existing = await tx.select().from(propertyDocuments)
          .where(eq(propertyDocuments.propertyId, propertyId))
          .limit(1);

        // Delete old files if being replaced
        if (existing.length > 0) {
          const old = existing[0];
          const docFields = ["gewogCertification", "internalAgreement", "occupancyCertificate", "plrVerification", "remainingPaymentScreenshot"];
          for (const field of docFields) {
            const oldUrl = old[field as keyof typeof old] as string | null;
            const newUrl = input[field as keyof typeof input] as string | undefined;
            if (oldUrl && oldUrl !== newUrl) {
              try { await deleteFile(oldUrl); } catch { /* ignore */ }
            }
          }
        }

        if (existing.length > 0) {
          await tx.update(propertyDocuments)
            .set({
              ...values,
              // Screenshots are no longer collected; clear any previously stored one
              remainingPaymentScreenshot: null,
              approvalStatus: "approved",
              approvedBy: userId,
              approvedAt: new Date(),
              comments: null,
            })
            .where(eq(propertyDocuments.propertyId, propertyId));
        } else {          await tx.insert(propertyDocuments).values({
            propertyId,
            ...values,
            uploadedBy: userId,
            approvalStatus: "approved",
            approvedBy: userId,
            approvedAt: new Date(),
          });
        }

        // ── Property agreement (uploaded in Step 3 together with all documents) ──
        if (agreementFile) {
          const existingAgreement = await tx.select().from(propertyAgreements)
            .where(eq(propertyAgreements.propertyId, propertyId))
            .limit(1);

          if (existingAgreement.length > 0) {
            const oldUrl = existingAgreement[0].agreementFile;
            if (oldUrl && oldUrl !== agreementFile) {
              try { await deleteFile(oldUrl); } catch { /* ignore */ }
            }
            await tx.update(propertyAgreements)
              .set({ agreementFile })
              .where(eq(propertyAgreements.propertyId, propertyId));
          } else {
            await tx.insert(propertyAgreements).values({
              propertyId,
              agreementFile,
              approvalStatus: "approved" as const,
              approvedBy: userId,
              approvedAt: new Date(),
            });
          }
        }

        await tx.update(properties)
          .set({ currentStep: Math.max(prop[0].currentStep, 4),
            approvalStatus: "approved",
          })
          .where(eq(properties.id, propertyId));

        await tx.insert(approvalHistory).values({
          propertyId,
          step: 3,
          action: "approved",
          adminId: userId,
          comments: isAdmin ? "Auto-approved by admin" : "Step 3 property documents completed",
        });

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
    )    .mutation(async ({ input, ctx }) => {      const db = getDb();      const userId = ctx.unifiedUser!.id;      const isAdmin = ctx.unifiedUser!.role === "admin";

      const values: {
        lagthramStatus: "pending" | "processing" | "completed";
        loanStatus: "pending" | "processing" | "completed";
        lagthramCompletedAt?: Date;
        loanCompletedAt?: Date;
      } = {
        lagthramStatus: input.lagthramStatus,
        loanStatus: input.loanStatus,
      };

      if (input.lagthramStatus === "completed") values.lagthramCompletedAt = new Date();
      if (input.loanStatus === "completed") values.loanCompletedAt = new Date();

      const isBothCompleted = input.lagthramStatus === "completed" && input.loanStatus === "completed";

      return await db.transaction(async (tx) => {
        const prop = await tx.select().from(properties).where(eq(properties.id, input.propertyId)).limit(1);
        if (prop.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });

        // Authorization: real-estate staff can modify ANY property; other roles cannot
        assertRealEstateModuleAccess(ctx.unifiedUser!.role);

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

        if (isBothCompleted) {
          await tx.update(verificationProcesses)
            .set({ approvedBy: userId, approvedAt: new Date() })
            .where(eq(verificationProcesses.propertyId, input.propertyId));

          await tx.update(properties)
            .set({ currentStep: Math.max(prop[0].currentStep, 5), approvalStatus: "approved", updatedAt: new Date() })
            .where(eq(properties.id, input.propertyId));

          await tx.insert(approvalHistory).values({
            propertyId: input.propertyId,
            step: 4,
            action: "approved",
            adminId: userId,
            comments: isAdmin ? "Auto-approved by admin" : "Step 4 verification completed",
          });
        } else {
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
        finalDocument: z.string().min(1, "Final document is required"),        completionCertificate: z.string().optional(),      })    )    .mutation(async ({ input, ctx }) => {      const db = getDb();      const userId = ctx.unifiedUser!.id;      const userName = ctx.unifiedUser!.name;      const isAdmin = ctx.unifiedUser!.role === "admin";

      const values = {
        finalDocument: input.finalDocument,
        completionCertificate: input.completionCertificate,
        approvalStatus: isAdmin ? ("approved" as const) : ("pending" as const),
      };

      return await db.transaction(async (tx) => {
        const prop = await tx.select().from(properties).where(eq(properties.id, input.propertyId)).limit(1);
        if (prop.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });

        // Authorization: real-estate staff can modify ANY property; other roles cannot
        assertRealEstateModuleAccess(ctx.unifiedUser!.role);

        if (!input.finalDocument) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Final Lagthram Document is required. Please upload the document." });
        }

        // Block resubmission while Step 5 is pending admin review
        if (!isAdmin && prop[0].approvalStatus === "pending_review" && prop[0].currentStep === 5) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Step 5 is already submitted and waiting for admin approval. Please wait for approval before resubmitting." });
        }

        const existing = await tx.select().from(finalLagthrams)
          .where(eq(finalLagthrams.propertyId, input.propertyId))
          .limit(1);

        // Delete old files if being replaced
        if (existing.length > 0) {
          const old = existing[0];
          if (old.finalDocument && old.finalDocument !== input.finalDocument) {
            try { await deleteFile(old.finalDocument); } catch { /* ignore */ }
          }
          if (old.completionCertificate && old.completionCertificate !== input.completionCertificate) {
            try { await deleteFile(old.completionCertificate); } catch { /* ignore */ }
          }
        }

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
            comments: "Final lagthram and completion documents submitted for admin approval",
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
      assertRealEstateModuleAccess(userRole);

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
          yearOfConstruction: properties.yearOfConstruction,
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

      // Staff can view the full workflow of ALL properties

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

      // Real-estate staff (like admin) work with the full data of all properties;
      // admin-only internal notes stay restricted to admins.
      const isAdmin = userRole === "admin";
      const p = property[0];
      const maskedProperty = {
        ...p,
        adminNotes: isAdmin ? p.adminNotes : null,
      };

      return {
        property: maskedProperty,
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

      // Verify access — real-estate staff may view documents of ALL properties
      if (!isRealEstateStaffRole(ctx.unifiedUser!.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
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
          case 4: {
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
          }
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
          case 4: {
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
          }
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

  pendingApprovals: adminQuery.query(async () => {
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

  staffDashboardStats: staffQuery.query(async () => {
    const db = getDb();
    // Staff now works with the whole property portfolio — stats cover all properties

    const totalProperties = await db.select({ count: count() })
      .from(properties);
    const pendingCount = await db.select({ count: count() })
      .from(properties)
      .where(or(eq(properties.approvalStatus, "submitted"), eq(properties.approvalStatus, "pending_review")));
    const rejectedCount = await db.select({ count: count() })
      .from(properties)
      .where(eq(properties.approvalStatus, "rejected"));
    const completedCount = await db.select({ count: count() })
      .from(properties)
      .where(eq(properties.workflowStatus, "completed"));

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

      if (!isRealEstateStaffRole(ctx.unifiedUser!.role)) {
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
      assertRealEstateModuleAccess(ctx.unifiedUser!.role);

      // All real-estate roles see every property
      const conditions = [];

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
        conditions.push(billingStatusCondition(input.status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const page = input.page || 1;
      const limit = input.limit || 20;
      const offset = (page - 1) * limit;

      // Count needs the same joins as the row query: payment-status filters
      // reference property_agreements / property_documents.
      const totalResult = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${properties.id})` })
        .from(properties)
        .leftJoin(propertyAgreements, eq(propertyAgreements.propertyId, properties.id))
        .leftJoin(propertyDocuments, eq(propertyDocuments.propertyId, properties.id))
        .where(whereClause);
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
          totalAmountPaid: propertyAgreements.totalAmountPaid,
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
        .offset(offset);      // Financial totals across all matching records (not just current page)
      // Reuses billingPriceSql/billingPaidSql so totals always match the filters.
      const priceExpr = billingPriceSql();
      const paidExpr = billingPaidSql();
      const totalsResult = await db.select({
        totalSellingPrice: sql<string>`COALESCE(SUM(${priceExpr}), 0)`,
        totalCommission: sql<string>`COALESCE(SUM(COALESCE(CAST(${propertyAgreements.commissionAmount} AS DECIMAL), CAST(${properties.realEstateFee} AS DECIMAL), 0)), 0)`,
        totalPaymentAmount: sql<string>`COALESCE(SUM(${paidExpr}), 0)`,
        totalRemainingDue: sql<string>`COALESCE(SUM(GREATEST(${priceExpr} - ${paidExpr}, 0)), 0)`,
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
        format: z.enum(["csv", "json", "pdf", "xlsx"]).default("csv"),
        // Security: Add pagination to prevent memory exhaustion on large datasets
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(1000).default(500),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      assertRealEstateModuleAccess(ctx.unifiedUser!.role);

      const conditions = [];

      // All real-estate roles see every property

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
        conditions.push(billingStatusCondition(input.status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Security: Limit max records to prevent memory exhaustion DoS
      const page = input?.page || 1;
      const limit = Math.min(input?.limit || 500, 1000); // Hard cap at 1000
      const offset = (page - 1) * limit;

      const results = await db
        .select({
          id: properties.id,
          propertyName: properties.propertyName,
          ownerName: properties.ownerName,
          buyerName: properties.buyerName,
          sellingPrice: properties.sellingPrice,
          finalSellingPrice: properties.finalSellingPrice,
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
          totalAmountPaid: propertyAgreements.totalAmountPaid,
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

      // Grand totals for the report header — accumulated from the exact same
      // per-row numbers, so the KPI strip always agrees with the table below it.
      const totalsAccum: BillingExportTotals = { sales: 0, paid: 0, due: 0, commission: 0, net: 0 };

      const formattedData = results.map((item) => {
        // Use finalSellingPrice when available, otherwise fall back to sellingPrice
        const basePrice = parseFloat(item.finalSellingPrice ?? item.sellingPrice ?? "0");
        const commission = parseFloat(item.commissionAmount ?? item.realEstateFee ?? "0");

        const isStep2Approved = item.currentStep >= 3;
        const isStep3Approved = item.currentStep >= 4;

        const hasTotalPaid = item.totalAmountPaid !== null && item.totalAmountPaid !== undefined;
        let totalPaid = 0;

        if (hasTotalPaid) {
          // New model: single "Total Amount Paid" recorded in Step 2
          totalPaid = isStep2Approved ? parseFloat(item.totalAmountPaid || "0") : 0;
        } else {
          // Legacy record: keep the original 50% advance + remaining split so past data is unchanged
          const hasExactPayment = item.paymentAmount !== null && item.paymentAmount !== undefined;
          const initialPayment = hasExactPayment ? parseFloat(item.paymentAmount || "0") : basePrice / 2;
          const hasExactRemaining = item.remainingPaymentAmount !== null && item.remainingPaymentAmount !== undefined;
          const remainingPayment = hasExactRemaining ? parseFloat(item.remainingPaymentAmount || "0") : Math.max(0, basePrice - initialPayment);
          totalPaid = (isStep2Approved ? initialPayment : 0) + (isStep3Approved ? remainingPayment : 0);
        }

        const balanceDue = Math.max(0, basePrice - totalPaid);
        const netToSeller = Math.max(0, basePrice - commission);

        totalsAccum.sales += basePrice;
        totalsAccum.paid += totalPaid;
        totalsAccum.due += balanceDue;
        totalsAccum.commission += commission;
        totalsAccum.net += netToSeller;

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
          totalPaid: fmtPlain(String(totalPaid)),
          balanceDue: fmtPlain(String(balanceDue)),
          commission: fmtPlain(String(commission)),
          netToSeller: fmtPlain(String(netToSeller)),
          percentPaid:
            basePrice > 0
              ? totalPaid >= basePrice
                ? 100
                : Math.min(99, Math.floor((totalPaid / basePrice) * 100))
              : 0,
          createdAt: item.createdAt ? format(item.createdAt, "yyyy-MM-dd") : "",
          completedAt: item.completedAt ? format(item.completedAt, "yyyy-MM-dd") : "",
        };
      });

      const exportFormat = input?.format || "csv";

      if (exportFormat === "json") {
        return { data: formattedData };
      }

      if (exportFormat === "xlsx" || exportFormat === "pdf") {
        const statusLabels: Record<string, string> = {
          pending: "Payment Pending",
          partial: "Partially Paid",
          paid: "Fully Paid",
          processing: "Processing",
          completed: "Completed",
          cancelled: "Cancelled",
          approved: "Approved",
          rejected: "Rejected",
        };
        const filters: string[] = [];
        if (input?.status) filters.push(`Status: ${statusLabels[input.status] ?? input.status}`);
        if (input?.search) filters.push(`Search: ${input.search}`);

        const branding = await getExportBranding();
        const meta: BillingExportMeta = {
          siteName: branding.siteName,
          logoDataUrl: branding.logoDataUrl,
          generatedOn: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          recordCount: formattedData.length,
          filters,
        };
        const rows = formattedData as unknown as BillingExportRow[];

        if (exportFormat === "xlsx") {
          return { xlsxBase64: await buildBillingExcelBase64(rows, totalsAccum, meta) };
        }
        return { pdfBase64: buildBillingPdfBase64(rows, totalsAccum, meta) };
      }

      const headers = ["invoiceNo", "propertyName", "ownerName", "buyerName", "propertyType", "listedBy", "status", "sellingPrice", "finalSellingPrice", "totalPaid", "balanceDue", "commission", "netToSeller", "percentPaid", "createdAt", "completedAt"];
      const csv = generateCSV(formattedData, headers);
      return { csv };
    }),
});
