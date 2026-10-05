import { z } from "zod";
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, or, sql, like } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, staffQuery } from "./middleware";
import { logger } from "./lib/logger";
import { getDb } from "./queries/connection";
import {
  clients,
  emailLogs,
  properties,
  propertyImages,
  propertyTypes,
  systemSettings,
} from "@db/schema";
import { sendEmail } from "./services/email";
import {
  renderCampaignEmail,
  renderTestEmail,
  replacePlaceholders,
  resolveHostedUrl,
  type EmailPropertyData,
} from "./lib/email-template";
import { buildUnsubscribeUrl } from "./lib/unsubscribe";

const MAX_RECIPIENTS = 500;
const MAX_PROPERTIES = 10;

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function getEmailBranding(): Promise<{ siteName: string; logoUrl: string | null }> {
  let siteName = "PHOJAA95";
  let siteLogo = "";
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(systemSettings)
      .where(sql`${systemSettings.key} IN ('site_name', 'site_logo')`);
    for (const row of rows) {
      if (row.key === "site_name" && row.value) siteName = row.value;
      if (row.key === "site_logo") siteLogo = row.value || "";
    }
  } catch {
    // branding must never break sending
  }
  return { siteName, logoUrl: resolveHostedUrl(siteLogo) };
}

const fmtPrice = (value?: string | number | null): string => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

/** Load several properties (with type + images) shaped for the email cards, in the given order. */
async function loadEmailProperties(ids: number[]): Promise<EmailPropertyData[]> {
  const unique = [...new Set(ids)].slice(0, MAX_PROPERTIES);
  if (!unique.length) return [];
  const db = getDb();
  const rows = await db
    .select({
      id: properties.id,
      propertyName: properties.propertyName,
      address: properties.address,
      sellingPrice: properties.sellingPrice,
      finalSellingPrice: properties.finalSellingPrice,
      yearOfConstruction: properties.yearOfConstruction,
      features: properties.features,
      typeName: propertyTypes.name,
    })
    .from(properties)
    .leftJoin(propertyTypes, eq(properties.propertyTypeId, propertyTypes.id))
    .where(inArray(properties.id, unique));

  const images = await db
    .select({ propertyId: propertyImages.propertyId, url: propertyImages.url })
    .from(propertyImages)
    .where(inArray(propertyImages.propertyId, unique))
    .orderBy(propertyImages.id);

  const imagesByProperty = new Map<number, string[]>();
  for (const img of images) {
    const url = resolveHostedUrl(img.url);
    if (!url) continue;
    const list = imagesByProperty.get(img.propertyId) ?? [];
    if (list.length < 6) list.push(url);
    imagesByProperty.set(img.propertyId, list);
  }

  const byId = new Map<number, EmailPropertyData>(
    rows.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.propertyName,
        price: fmtPrice(p.finalSellingPrice ?? p.sellingPrice),
        address: p.address,
        typeName: p.typeName,
        year: p.yearOfConstruction,
        features: p.features,
        imageUrls: imagesByProperty.get(p.id) ?? [],
      },
    ]),
  );
  // Preserve the caller's order; drop ids that no longer exist.
  return unique
    .map((id) => byId.get(id))
    .filter((p): p is EmailPropertyData => p !== undefined);
}

/** Load one property (with type + images) shaped for the email card. */
async function loadEmailProperty(id: number): Promise<EmailPropertyData | null> {
  const [first] = await loadEmailProperties([id]);
  return first ?? null;
}

interface CampaignInput {
  subject: string;
  body: string;
  propertyIds?: number[] | null;
  includeProperty?: boolean;
}

/** Merge the new `propertyIds` with any legacy single-property id, deduped + capped. */
function resolvePropertyIds(input: { propertyIds?: number[] | null; propertyId?: number | null }): number[] {
  const ids = [...(input.propertyIds ?? []), ...(input.propertyId != null ? [input.propertyId] : [])];
  return [...new Set(ids)].filter((id) => Number.isFinite(id) && id > 0).slice(0, MAX_PROPERTIES);
}

async function renderForRecipient(
  input: CampaignInput,
  recipient: { name: string; email: string },
  branding: { siteName: string; logoUrl: string | null },
  properties: EmailPropertyData[],
): Promise<{ subject: string; html: string; unsubscribeUrl: string }> {
  const first = properties[0];
  const vars = {
    clientName: recipient.name || "Valued Client",
    // Placeholders describe a single property — use the first selected one.
    propertyName: first?.name ?? "",
    price: first?.price ?? "",
    address: first?.address ?? "",
    siteName: branding.siteName,
  };
  const subject = replacePlaceholders(input.subject, vars);
  const body = replacePlaceholders(input.body, vars);
  const unsubscribeUrl = buildUnsubscribeUrl(recipient.email);
  const html = renderCampaignEmail({
    siteName: branding.siteName,
    logoUrl: branding.logoUrl,
    toName: recipient.name || "Valued Client",
    subject,
    body,
    properties,
    includeProperty: Boolean(input.includeProperty && properties.length),
    unsubscribeUrl,
  });
  return { subject, html, unsubscribeUrl };
}

export const emailRouter = createRouter({
  /** SMTP configuration status for the UI banner + test button. */
  status: staffQuery.query(() => ({
    configured: isSmtpConfigured(),
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    from: process.env.SMTP_FROM || "noreply@phojaa95.com",
  })),

  sendTest: staffQuery
    .input(z.object({ to: z.string().trim().toLowerCase().email() }))
    .mutation(async ({ input }) => {
      if (!isSmtpConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS on the server.",
        });
      }
      const branding = await getEmailBranding();
      await sendEmail({
        to: input.to,
        subject: `${branding.siteName} — SMTP test`,
        html: renderTestEmail(branding.siteName, branding.logoUrl),
      });
      return { success: true };
    }),

  /** Lightweight property picker results. */
  searchProperties: staffQuery
    .input(z.object({ search: z.string().optional(), limit: z.number().min(1).max(50).optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const search = input?.search?.trim();
      const limit = input?.limit ?? 25;
      const conds = [];
      if (search) {
        const s = `%${search}%`;
        conds.push(or(like(properties.propertyName, s), like(properties.address, s)));
      }
      const rows = await db
        .select({
          id: properties.id,
          propertyName: properties.propertyName,
          address: properties.address,
          sellingPrice: properties.sellingPrice,
          finalSellingPrice: properties.finalSellingPrice,
          workflowStatus: properties.workflowStatus,
          typeName: propertyTypes.name,
        })
        .from(properties)
        .leftJoin(propertyTypes, eq(properties.propertyTypeId, propertyTypes.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(properties.id))
        .limit(limit);

      const ids = rows.map((r) => r.id);
      const images = ids.length
        ? await db
            .select({ propertyId: propertyImages.propertyId, id: propertyImages.id, url: propertyImages.url })
            .from(propertyImages)
            .where(inArray(propertyImages.propertyId, ids))
            .orderBy(propertyImages.id)
        : [];

      // First image per property = cover
      const coverById = new Map<number, string | null>();
      for (const img of images) {
        if (!coverById.has(img.propertyId)) coverById.set(img.propertyId, resolveHostedUrl(img.url));
      }
      return rows.map((r) => ({
        ...r,
        price: fmtPrice(r.finalSellingPrice ?? r.sellingPrice),
        coverImage: coverById.get(r.id) ?? null,
      }));
    }),

  /** Full property payload for the composer card / preview. */
  getProperty: staffQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => loadEmailProperty(input.id)),

  /** Batch payload for every selected property in the composer (order preserved). */
  getProperties: staffQuery
    .input(z.object({ ids: z.array(z.number()).min(1).max(MAX_PROPERTIES) }))
    .query(async ({ input }) => loadEmailProperties(input.ids)),

  /** Render the exact HTML that would be sent (for the preview iframe). */
  preview: staffQuery
    .input(
      z.object({
        subject: z.string(),
        body: z.string(),
        propertyIds: z.array(z.number()).max(MAX_PROPERTIES).optional(),
        propertyId: z.number().nullable().optional(), // legacy single-property callers
        includeProperty: z.boolean().default(true),
        sampleName: z.string().default("Pema Wangmo"),
      }),
    )
    .mutation(async ({ input }) => {
      const branding = await getEmailBranding();
      const properties = await loadEmailProperties(resolvePropertyIds(input));
      const { subject, html } = await renderForRecipient(
        input,
        { name: input.sampleName, email: "sample@phojaa95.com" },
        branding,
        properties,
      );
      return { subject, html };
    }),

  /** Send to selected clients. Sequential with per-recipient logging. */
  sendCampaign: staffQuery
    .input(
      z.object({
        subject: z.string().trim().min(1).max(500),
        body: z.string().max(20000).default(""),
        propertyIds: z.array(z.number()).max(MAX_PROPERTIES).optional(),
        propertyId: z.number().nullable().optional(), // legacy single-property callers
        includeProperty: z.boolean().default(true),
        clientIds: z.array(z.number()).min(1).max(MAX_RECIPIENTS),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!isSmtpConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS on the server.",
        });
      }

      const db = getDb();
      const recipients = await db
        .select()
        .from(clients)
        .where(and(inArray(clients.id, input.clientIds), eq(clients.status, "active")));

      if (!recipients.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active clients selected." });
      }

      const branding = await getEmailBranding();
      const properties = await loadEmailProperties(resolvePropertyIds(input));
      const batchId = randomUUID();
      const senderId = ctx.unifiedUser?.id ?? null;
      const senderName = ctx.unifiedUser?.name ?? null;

      let sent = 0;
      let failed = 0;

      for (const client of recipients) {
        const name = (client.fullName || client.email).slice(0, 255);
        // Send first, then log — a logging failure must never misreport an
        // email that actually went out (or vice versa).
        let renderedSubject = input.subject;
        let emailError: unknown = null;
        try {
          const { subject, html, unsubscribeUrl } = await renderForRecipient(
            input,
            { name, email: client.email },
            branding,
            properties,
          );
          renderedSubject = subject;
          await sendEmail({
            to: client.email,
            subject,
            html,
            headers: {
              "List-Unsubscribe": `<${unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          });
        } catch (err) {
          emailError = err;
        }

        // `subject` is varchar(500) — a long property name can push the
        // rendered subject past the column and break the log insert.
        const logSubject = renderedSubject.slice(0, 500);

        try {
          await db.insert(emailLogs).values({
            batchId,
            clientId: client.id,
            // First selected property (the campaign's "primary" listing).
            propertyId: properties[0]?.id ?? null,
            subject: logSubject,
            toEmail: client.email,
            toName: name,
            status: emailError ? "failed" : "sent",
            error: emailError
              ? emailError instanceof Error
                ? emailError.message.slice(0, 1000)
                : "Unknown error"
              : null,
            sentBy: senderId,
            sentByName: senderName,
          });
        } catch (logErr) {
          // The email outcome is already decided — never let a broken log
          // write crash the batch or flip the reported result.
          logger.error("email_logs insert failed", {
            error: String(logErr),
            toEmail: client.email,
            batchId,
          });
        }
        if (emailError) failed++;
        else sent++;
      }

      return { batchId, sent, failed, total: recipients.length };
    }),

  /** Sent history (newest first). */
  history: staffQuery
    .input(
      z
        .object({
          search: z.string().optional(),
          status: z.enum(["sent", "failed"]).optional(),
          limit: z.number().min(1).max(500).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conds = [];
      if (input?.search) {
        const s = `%${input.search}%`;
        conds.push(or(like(emailLogs.subject, s), like(emailLogs.toEmail, s), like(emailLogs.toName, s)));
      }
      if (input?.status) conds.push(eq(emailLogs.status, input.status));

      return db
        .select()
        .from(emailLogs)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(emailLogs.createdAt))
        .limit(input?.limit ?? 100);
    }),

  /** Accurate all-time counts for the KPI cards (history is paginated to 100). */
  historyStats: staffQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({ status: emailLogs.status, n: sql<number>`COUNT(*)` })
      .from(emailLogs)
      .groupBy(emailLogs.status);
    let total = 0;
    let sent = 0;
    let failed = 0;
    for (const row of rows) {
      const n = Number(row.n) || 0;
      total += n;
      if (row.status === "sent") sent += n;
      else failed += n;
    }
    return { total, sent, failed };
  }),
});
