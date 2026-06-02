import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, staffQuery, adminQuery } from "./middleware";
import { resolveDocumentMimeType, resolveArchitectureMimeType, isAllowedArchitectureUpload } from "@contracts/upload";
import { uploadFile, deleteFile, getSignedDownloadUrl, validateFileType, validateFileSize } from "./services/upload";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const uploadRouter = createRouter({
  upload: staffQuery
    .input(
      z.object({
        file: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        folder: z.enum(["properties", "agreements", "documents", "verification", "final", "profiles", "payslips", "library", "architecture"]),
        propertyId: z.number().optional(),
        step: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { file, fileName, mimeType, folder, propertyId, step } = input;

      if (propertyId) {
        const { getDb } = await import("./queries/connection");
        const { properties } = await import("@db/schema");
        const { eq } = await import("drizzle-orm");
        const db = getDb();
        const prop = await db.select({ listedById: properties.listedById }).from(properties).where(eq(properties.id, propertyId)).limit(1);
        if (prop.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
        }
        const user = ctx.unifiedUser!;
        if (prop[0].listedById !== user.id && user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to upload to this property" });
        }
      }

      const isArchitectureFolder = folder === "architecture";
      const resolvedMimeType = isArchitectureFolder
        ? resolveArchitectureMimeType(fileName, mimeType)
        : resolveDocumentMimeType(fileName, mimeType);

      const typeOk = isArchitectureFolder
        ? isAllowedArchitectureUpload(fileName, resolvedMimeType)
        : validateFileType(resolvedMimeType, fileName);

      if (!typeOk) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: isArchitectureFolder
            ? "File type not allowed. Allowed: PDF, Word, images, DWG/DXF, MP4, or ZIP"
            : "File type not allowed",
        });
      }

      const buffer = Buffer.from(file, "base64");
      if (!validateFileSize(buffer.length)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` });
      }

      let folderPath: string;
      if (propertyId && step) {
        folderPath = `properties/${propertyId}/step-${step}`;
      } else if (propertyId) {
        folderPath = `properties/${propertyId}/${folder}`;
      } else {
        folderPath = folder;
      }

      const result = await uploadFile(buffer, fileName, resolvedMimeType, folderPath);

      return {
        key: result.key,
        url: result.url,
        signedUrl: result.signedUrl,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
      };
    }),

  delete: adminQuery
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input }) => {
      await deleteFile(input.key);
      return { success: true };
    }),

  getDownloadUrl: staffQuery
    .input(z.object({ key: z.string(), expiresIn: z.number().optional() }))
    .query(async ({ input }) => {
      const url = await getSignedDownloadUrl(input.key, input.expiresIn || 3600);
      return { url };
    }),

  getDownloadUrls: staffQuery
    .input(z.object({ keys: z.array(z.string()).max(50) }))
    .query(async ({ input }) => {
      const urls = await Promise.all(
        input.keys.map(async (key) => ({
          key,
          url: await getSignedDownloadUrl(key),
        }))
      );
      return urls;
    }),

  getPropertyDocuments: staffQuery
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ input, ctx }) => {
      const { getDb } = await import("./queries/connection");
      const { properties, propertyAgreements, propertyDocuments, finalLagthrams } = await import("@db/schema");
      const { eq } = await import("drizzle-orm");

      const db = getDb();

      const prop = await db
        .select({
          id: properties.id,
          propertyName: properties.propertyName,
          propertyTypeId: properties.propertyTypeId,
          listedById: properties.listedById,
        })
        .from(properties)
        .where(eq(properties.id, input.propertyId))
        .limit(1);

      if (prop.length === 0) {
        return { documents: [] };
      }

      const user = ctx.unifiedUser!;
      if (prop[0].listedById !== user.id && user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to view this property's documents" });
      }

      const agreement = await db
        .select()
        .from(propertyAgreements)
        .where(eq(propertyAgreements.propertyId, input.propertyId))
        .limit(1);

      const documents = await db
        .select()
        .from(propertyDocuments)
        .where(eq(propertyDocuments.propertyId, input.propertyId))
        .limit(1);

      const finalDoc = await db
        .select()
        .from(finalLagthrams)
        .where(eq(finalLagthrams.propertyId, input.propertyId))
        .limit(1);

      const allDocuments: { name: string; url: string | null; step: number }[] = [];

      if (agreement[0]) {
        if (agreement[0].agreementFile) {
          allDocuments.push({ name: "Agreement File", url: agreement[0].agreementFile, step: 2 });
        }
        if (agreement[0].paymentScreenshot) {
          allDocuments.push({ name: "Payment Screenshot (50%)", url: agreement[0].paymentScreenshot, step: 2 });
        }
      }

      if (documents[0]) {
        if (documents[0].gewogCertification) {
          allDocuments.push({ name: "Gewog Certification", url: documents[0].gewogCertification, step: 3 });
        }
        if (documents[0].internalAgreement) {
          allDocuments.push({ name: "Internal Agreement", url: documents[0].internalAgreement, step: 3 });
        }
        if (documents[0].occupancyCertificate) {
          allDocuments.push({ name: "Occupancy Certificate", url: documents[0].occupancyCertificate, step: 3 });
        }
        if (documents[0].plrVerification) {
          allDocuments.push({ name: "PLR Verification", url: documents[0].plrVerification, step: 3 });
        }
        if (documents[0].remainingPaymentScreenshot) {
          allDocuments.push({ name: "Remaining Payment Screenshot", url: documents[0].remainingPaymentScreenshot, step: 3 });
        }
      }

      if (finalDoc[0]) {
        if (finalDoc[0].finalDocument) {
          allDocuments.push({ name: "Final Lagthram Document", url: finalDoc[0].finalDocument, step: 5 });
        }
        if (finalDoc[0].completionCertificate) {
          allDocuments.push({ name: "Completion Certificate", url: finalDoc[0].completionCertificate, step: 5 });
        }
      }

      return { documents: allDocuments.filter(d => d.url) };
    }),
});