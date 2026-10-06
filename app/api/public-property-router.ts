/**
 * Public (no-login) property endpoint for email campaign recipients.
 *
 * Campaign emails link to /p/:id, which email clients open without any
 * session. This router exposes ONLY marketing-safe fields — never owner
 * CID/phone, negotiated prices, fees, admin notes, or buyer data.
 */
import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { properties, propertyImages, propertyTypes } from "@db/schema";

/** Lifecycle stages a property must reach before it can be shared publicly. */
const PUBLIC_STATUSES = ["submitted", "pending_review", "approved", "completed"] as const;

export const publicPropertyRouter = createRouter({
  /** One property, shaped for the public landing page. Null when not shareable. */
  get: publicQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select({
          id: properties.id,
          propertyName: properties.propertyName,
          typeName: propertyTypes.name,
          address: properties.address,
          sellingPrice: properties.sellingPrice,
          finalSellingPrice: properties.finalSellingPrice,
          yearOfConstruction: properties.yearOfConstruction,
          features: properties.features,
          isSold: properties.isSold,
        })
        .from(properties)
        .leftJoin(propertyTypes, eq(properties.propertyTypeId, propertyTypes.id))
        .where(
          and(
            eq(properties.id, input.id),
            inArray(properties.approvalStatus, [...PUBLIC_STATUSES]),
          ),
        )
        .limit(1);

      if (!rows.length) return null;

      const images = await db
        .select({ url: propertyImages.url })
        .from(propertyImages)
        .where(eq(propertyImages.propertyId, input.id))
        .orderBy(asc(propertyImages.id));

      return { ...rows[0], imageUrls: images.map((img) => img.url) };
    }),
});

export type PublicPropertyRouter = typeof publicPropertyRouter;
