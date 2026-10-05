import { env } from "./env";

/* ────────────────────────────────────────────────────────────────────
 * HTML email rendering for client campaigns.
 * Table-based layout + inline styles = works in Gmail/Outlook/Yahoo.
 * ──────────────────────────────────────────────────────────────────── */

export interface EmailPropertyData {
  id: number;
  name: string;
  price: string; // pre-formatted, e.g. "4,500,000.00"
  address: string;
  typeName?: string | null;
  year?: number | null;
  features?: unknown; // json column — Record<string,string> in practice
  imageUrls: string[]; // absolute URLs (https://... or appUrl + /uploads/...)
}

export interface CampaignEmailInput {
  siteName: string;
  logoUrl?: string | null; // hosted URL only — data URIs are stripped by Gmail
  toName: string;
  subject: string;
  body: string; // plain text; placeholders {{clientName}} etc. already replaced
  /** One card per property, stacked in the given order. */
  properties?: EmailPropertyData[];
  /** @deprecated legacy single-property callers — merged into `properties`. */
  property?: EmailPropertyData | null;
  includeProperty?: boolean;
  /** Signed one-click opt-out link; omit the link entirely when absent. */
  unsubscribeUrl?: string | null;
}

const BRAND = "#4F46E5";
const INK = "#0F172A";
const MUTED = "#64748B";
const HAIR = "#E2E8F0";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;",
  );

/** Turn the composer's plain text into safe HTML paragraphs. */
export function bodyToHtml(body: string): string {
  const normalised = (body || "").replace(/\r\n/g, "\n").trim();
  if (!normalised) return "";
  return normalised
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 14px 0;">${escapeHtml(para).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

/** Replace {{placeholders}} in subject/body. Unknown keys are left as-is. */
export function replacePlaceholders(
  text: string,
  vars: Record<string, string | undefined>,
): string {
  return (text || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) && vars[key] !== undefined ? String(vars[key]) : match,
  );
}

/** Hosted URL for an img src, or null when only a data URI is available. */
export function resolveHostedUrl(value?: string | null): string | null {
  const raw = (value || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("data:")) return null; // Gmail/Outlook strip data URIs
  const base = env.appUrl.replace(/\/+$/, "");
  return `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function normaliseFeatures(features: unknown): Array<[string, string]> {
  let value = features;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => [item, ""] as [string, string]);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && String(v).trim().length > 0)
      .map(([k, v]) => [k, String(v)] as [string, string]);
  }
  return [];
}

function featureListHtml(features: unknown): string {
  const entries = normaliseFeatures(features).slice(0, 8);
  if (entries.length === 0) return "";
  const cells = entries
    .map(([key, val]) => {
      const label = escapeHtml(key);
      const value = escapeHtml(val);
      const text = value ? `${label}: <strong>${value}</strong>` : label;
      return `<td style="padding:5px 0;width:50%;vertical-align:top;font-size:13px;color:${INK};">
        <span style="color:${BRAND};margin-right:6px;">&#10003;</span>${text}
      </td>`;
    })
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 4px 0;"><tr>${cells}${entries.length % 2 ? '<td style="width:50%;"></td>' : ""}</tr></table>`;
}

function propertyCardHtml(property: EmailPropertyData, index = 0, total = 1): string {
  // Full-bleed cover image inside the card — edge-to-edge, no side padding.
  const image = property.imageUrls[0]
    ? `<tr><td style="padding:0;">
        <img src="${escapeHtml(property.imageUrls[0])}" alt="${escapeHtml(property.name)}"
             width="560" style="display:block;width:100%;height:240px;object-fit:cover;border:0;" />
      </td></tr>`
    : "";

  const meta: string[] = [];
  if (property.typeName) meta.push(escapeHtml(property.typeName));
  if (property.year) meta.push(`Built ${property.year}`);

  const detailUrl = `${env.appUrl.replace(/\/+$/, "")}/properties/${property.id}`;
  const cta = `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 2px 0;border-collapse:separate;">
        <tr><td style="background:${BRAND};border-radius:8px;">
          <a href="${escapeHtml(detailUrl)}"
             style="display:inline-block;padding:11px 26px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;">
            View Property &nbsp;&rarr;
          </a>
        </td></tr>
      </table>`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="border:1px solid ${HAIR};border-radius:12px;border-collapse:separate;overflow:hidden;background:#FFFFFF;">
    ${image}
    <tr><td style="padding:18px 20px 20px 20px;">
      <div style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:${BRAND};font-weight:700;margin-bottom:8px;">${
        total > 1 ? `Property ${index + 1} of ${total}` : "Featured Property"
      }</div>
      <div style="font-size:19px;font-weight:700;color:${INK};line-height:1.3;">${escapeHtml(property.name)}</div>
      ${meta.length ? `<div style="font-size:13px;color:${MUTED};margin-top:4px;">${meta.join(" &nbsp;·&nbsp; ")}</div>` : ""}
      <div style="font-size:26px;font-weight:800;color:${BRAND};line-height:1.2;margin-top:12px;">Nu. ${escapeHtml(property.price.replace(/\.00$/, ""))}</div>
      <div style="font-size:13px;color:${MUTED};margin-top:4px;">&#128205; ${escapeHtml(property.address)}</div>
      ${featureListHtml(property.features)}
      ${cta}
    </td></tr>
  </table>`;
}

export function renderCampaignEmail(input: CampaignEmailInput): string {
  const { siteName, logoUrl, toName, body, includeProperty } = input;
  // New array shape, with a fallback for legacy single-property callers.
  const properties = (
    input.properties ?? (input.property ? [input.property] : [])
  ).filter(Boolean);
  const safeSite = escapeHtml(siteName);
  // Greet by first name only — friendlier for email. Fall back when empty.
  const nameParts = (toName || "").trim().split(/\s+/).filter(Boolean);
  const greeting = escapeHtml(nameParts[0] || "Hi there");
  // Hidden preheader so inbox previews show the subject line cleanly
  const preheader = escapeHtml(input.subject);
  const unsubscribeLine = input.unsubscribeUrl
    ? `<a href="${escapeHtml(input.unsubscribeUrl)}" style="color:${BRAND};">Unsubscribe</a> from these emails.`
    : `Reply to this email if you no longer wish to receive these messages.`;

  const header = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${safeSite}" height="40"
         style="display:block;height:40px;max-width:220px;" />`
    : `<div style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:0.4px;">${safeSite}</div>`;

  const showCards = Boolean(includeProperty && properties.length);
  const bodyHtml = bodyToHtml(body);

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid ${HAIR};">
        <!-- Brand header -->
        <tr><td style="background:${BRAND};padding:22px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td align="left">${header}</td>
            <td align="right" style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:700;vertical-align:middle;">
              Property Update
            </td>
          </tr></table>
        </td></tr>

        <!-- Content -->
        <tr><td style="padding:26px 24px 8px 24px;">
          <div style="font-size:16px;color:${INK};font-weight:600;margin-bottom:12px;">${greeting},</div>
          ${bodyHtml}
          ${
            showCards
              ? properties
                  .map(
                    (p, i) =>
                      `${i === 0 ? '<div style="height:6px;"></div>' : '<div style="height:14px;"></div>'}${propertyCardHtml(p, i, properties.length)}`,
                  )
                  .join("")
              : ""
          }
          <div style="height:10px;"></div>
          <div style="font-size:14px;color:${INK};">Warm regards,</div>
          <div style="font-size:15px;font-weight:700;color:${BRAND};margin-top:2px;">${safeSite} Team</div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:18px 24px 24px 24px;border-top:1px solid ${HAIR};">
          <div align="center" style="font-size:12px;color:${MUTED};line-height:1.7;">
            &copy; ${new Date().getFullYear()} ${safeSite}. All rights reserved.<br/>
            You are receiving this email because you are on our client list.<br/>
            ${unsubscribeLine}
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Small "SMTP works" mail used by the Send Test button. */
export function renderTestEmail(siteName: string, logoUrl?: string | null): string {
  const safeSite = escapeHtml(siteName);
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:14px;border:1px solid ${HAIR};">
        <tr><td style="background:${BRAND};padding:18px 24px;">
          ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${safeSite}" height="40" style="display:block;height:40px;max-width:220px;" />` : `<div style="font-size:22px;font-weight:800;color:#FFFFFF;">${safeSite}</div>`}
        </td></tr>
        <tr><td style="padding:26px 24px;">
          <div style="font-size:18px;font-weight:700;color:${INK};margin-bottom:10px;">SMTP is working &#9989;</div>
          <p style="font-size:14px;color:${MUTED};line-height:1.6;margin:0;">
            This test email was sent from ${safeSite}. Your campaign emails will use the same connection.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
