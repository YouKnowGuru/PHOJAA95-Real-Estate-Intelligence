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

/* Palette — keep every colour inline; email clients ignore <style> blocks. */
const BRAND = "#4F46E5"; // indigo-600
const BRAND_TINT = "#EEF2FF"; // indigo-50
const INK = "#0F172A"; // slate-900 (headings)
const BODY = "#334155"; // slate-700 (paragraphs)
const MUTED = "#64748B"; // slate-500 (meta)
const HAIR = "#E2E8F0"; // slate-200 (borders)
const PAGE_BG = "#EEF2F7"; // page backdrop
const FOOT_BG = "#F8FAFC"; // footer band
const FONT = "Arial,Helvetica,sans-serif";

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
    .map(
      (para) =>
        `<p style="margin:0 0 14px 0;font-family:${FONT};font-size:15px;line-height:1.75;color:${BODY};">${escapeHtml(para).replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");
}

/** Replace {{placeholders}} in subject/body. Unknown keys are left as-is. */
export function replacePlaceholders(
  text: string,
  vars: Record<string, string | undefined>,
): string {
  return (text || "").replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (match, key: string) =>
      Object.prototype.hasOwnProperty.call(vars, key) && vars[key] !== undefined
        ? String(vars[key])
        : match,
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
  const entries = normaliseFeatures(features).slice(0, 6);
  if (entries.length === 0) return "";
  const cell = ([key, val]: [string, string]): string => {
    const label = escapeHtml(key);
    const value = escapeHtml(val);
    const text = value ? `${label}: <strong style="color:${INK};">${value}</strong>` : label;
    return `<td width="50%" style="padding:7px 12px 7px 0;width:50%;vertical-align:top;font-family:${FONT};font-size:13px;line-height:1.5;color:${BODY};">
        <span style="color:${BRAND};font-weight:700;margin-right:6px;">&#10003;</span>${text}
      </td>`;
  };
  // Two features per row — one <tr> per pair, with an empty filler cell on odd rows.
  const rows: string[] = [];
  for (let i = 0; i < entries.length; i += 2) {
    rows.push(`<tr>${cell(entries[i])}${entries[i + 1] ? cell(entries[i + 1]) : '<td width="50%" style="width:50%;"></td>'}</tr>`);
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 2px 0;border-top:1px solid ${HAIR};">${rows.join("")}</table>`;
}

function propertyCardHtml(property: EmailPropertyData, index = 0, total = 1): string {
  const eyebrow = total > 1 ? `Property ${index + 1} of ${total}` : "Featured Property";

  // Top corners are rounded on the image itself — Gmail ignores overflow:hidden.
  const image = property.imageUrls[0]
    ? `<tr><td style="padding:0;background:${BRAND_TINT};" bgcolor="${BRAND_TINT}">
        <img src="${escapeHtml(property.imageUrls[0])}" alt="${escapeHtml(property.name)}"
             width="598" height="260"
             style="display:block;width:100%;height:260px;object-fit:cover;border:0;border-radius:15px 15px 0 0;" />
      </td></tr>`
    : `<tr><td align="center" style="padding:0;background:${BRAND_TINT};border-radius:15px 15px 0 0;" bgcolor="${BRAND_TINT}">
        <div style="font-family:${FONT};font-size:44px;line-height:1;padding:44px 0 8px 0;">&#127968;</div>
        <div style="font-family:${FONT};font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${BRAND};font-weight:700;padding:0 0 44px 0;">Photo coming soon</div>
      </td></tr>`;

  const meta: string[] = [];
  if (property.typeName) meta.push(escapeHtml(property.typeName));
  if (property.year) meta.push(`Built ${property.year}`);

  // Public landing page — email recipients have no account, so the internal
  // /properties/:id route (login-gated) would bounce them to the sign-in screen.
  const detailUrl = `${env.appUrl.replace(/\/+$/, "")}/p/${property.id}`;
  const cta = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:18px auto 0 auto;border-collapse:separate;">
        <tr><td align="center" bgcolor="${BRAND}" style="background:${BRAND};border-radius:10px;">
          <a href="${escapeHtml(detailUrl)}"
             style="display:inline-block;padding:13px 36px;font-family:${FONT};font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;">
            View Property &nbsp;&rarr;
          </a>
        </td></tr>
      </table>`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="border:1px solid ${HAIR};border-radius:16px;border-collapse:separate;background:#FFFFFF;">
    ${image}
    <tr><td style="padding:22px 24px 24px 24px;background:#FFFFFF;border-radius:0 0 15px 15px;font-family:${FONT};" bgcolor="#FFFFFF">
      <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${BRAND};font-weight:700;margin-bottom:8px;">${eyebrow}</div>
      <div style="font-size:20px;font-weight:700;color:${INK};line-height:1.35;">${escapeHtml(property.name)}</div>
      ${meta.length ? `<div style="font-size:13px;color:${MUTED};margin-top:6px;">${meta.join(" &nbsp;&middot;&nbsp; ")}</div>` : ""}
      <div style="margin-top:14px;">
        <span style="display:inline-block;background:${BRAND_TINT};color:${BRAND};font-size:24px;font-weight:800;padding:10px 16px;border-radius:10px;">Nu. ${escapeHtml(property.price.replace(/\.00$/, ""))}</span>
      </div>
      <div style="font-size:13px;color:${MUTED};margin-top:10px;">&#128205; ${escapeHtml(property.address)}</div>
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
  // Greet by first name — friendlier for email. Fall back when empty.
  const nameParts = (toName || "").trim().split(/\s+/).filter(Boolean);
  const greeting = nameParts[0] ? `Hi ${escapeHtml(nameParts[0])},` : "Hi there,";
  // Hidden preheader so inbox previews show the subject line cleanly
  const preheader = escapeHtml(input.subject);
  const unsubscribeLine = input.unsubscribeUrl
    ? `<a href="${escapeHtml(input.unsubscribeUrl)}" style="color:${BRAND};font-weight:700;text-decoration:none;">Unsubscribe</a> from these emails.`
    : `Reply to this email if you no longer wish to receive these messages.`;

  const header = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${safeSite}" height="40"
         style="display:block;height:40px;max-width:220px;border:0;" />`
    : `<div style="font-size:20px;font-weight:800;color:${INK};letter-spacing:0.4px;">${safeSite}</div>`;

  const showCards = Boolean(includeProperty && properties.length);
  const bodyHtml = bodyToHtml(body);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:${FONT};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE_BG}" style="background:${PAGE_BG};">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid ${HAIR};">
        <!-- Accent strip -->
        <tr><td height="5" style="height:5px;line-height:5px;font-size:0;background:${BRAND};border-radius:14px 14px 0 0;" bgcolor="${BRAND}">&nbsp;</td></tr>

        <!-- Brand header -->
        <tr><td style="background:#FFFFFF;padding:20px 24px;border-bottom:1px solid ${HAIR};" bgcolor="#FFFFFF">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="left" valign="middle">${header}</td>
            <td align="right" valign="middle">
              <span style="display:inline-block;background:${BRAND_TINT};color:${BRAND};font-family:${FONT};font-size:10px;letter-spacing:1.8px;text-transform:uppercase;font-weight:700;padding:6px 12px;border-radius:999px;">Property Update</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Content -->
        <tr><td style="padding:28px 24px 10px 24px;">
          <div style="font-family:${FONT};font-size:18px;color:${INK};font-weight:700;margin-bottom:12px;">${greeting}</div>
          ${bodyHtml}
          ${
            showCards
              ? properties
                  .map(
                    (p, i) =>
                      `${i === 0 ? '<div style="height:10px;"></div>' : '<div style="height:16px;"></div>'}${propertyCardHtml(p, i, properties.length)}`,
                  )
                  .join("")
              : ""
          }
          <div style="height:24px;"></div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="border-top:1px solid ${HAIR};padding-top:18px;">
            <div style="font-family:${FONT};font-size:14px;color:${BODY};">Warm regards,</div>
            <div style="font-family:${FONT};font-size:15px;font-weight:700;color:${BRAND};margin-top:3px;">${safeSite} Team</div>
          </td></tr></table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:18px 24px 24px 24px;border-top:1px solid ${HAIR};background:${FOOT_BG};border-radius:0 0 14px 14px;" bgcolor="${FOOT_BG}">
          <div align="center" style="font-family:${FONT};font-size:12px;color:${MUTED};line-height:1.8;">
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
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:${FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE_BG}" style="background:${PAGE_BG};">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border-radius:14px;border:1px solid ${HAIR};">
        <tr><td height="5" style="height:5px;line-height:5px;font-size:0;background:${BRAND};border-radius:14px 14px 0 0;" bgcolor="${BRAND}">&nbsp;</td></tr>
        <tr><td style="background:#FFFFFF;padding:22px 24px;border-bottom:1px solid ${HAIR};" bgcolor="#FFFFFF">
          ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${safeSite}" height="40" style="display:block;height:40px;max-width:220px;border:0;" />` : `<div style="font-size:20px;font-weight:800;color:${INK};letter-spacing:0.4px;">${safeSite}</div>`}
        </td></tr>
        <tr><td style="background:#FFFFFF;padding:28px 24px;" bgcolor="#FFFFFF">
          <div style="font-size:19px;font-weight:700;color:${INK};margin-bottom:10px;">SMTP is working &#9989;</div>
          <p style="margin:0;font-family:${FONT};font-size:14px;color:${BODY};line-height:1.75;">
            This test email was sent from ${safeSite}. Your campaign emails will use the same connection.
          </p>
        </td></tr>
        <tr><td style="padding:16px 24px 22px 24px;border-top:1px solid ${HAIR};background:${FOOT_BG};border-radius:0 0 14px 14px;" bgcolor="${FOOT_BG}">
          <div align="center" style="font-family:${FONT};font-size:12px;color:${MUTED};">
            &copy; ${new Date().getFullYear()} ${safeSite}
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
