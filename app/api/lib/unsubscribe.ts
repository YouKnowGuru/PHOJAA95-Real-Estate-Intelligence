/**
 * One-click unsubscribe for campaign emails.
 *
 * The old footer linked to the admin /settings page, which a client can't use.
 * This signs the recipient's address with the app secret and exposes a public
 * GET endpoint that flips the client to `unsubscribed` — no login required.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { clients } from "@db/schema";
import { env } from "./env";
import { getDb } from "../queries/connection";
import { logger } from "./logger";

/** Short HMAC of the (lower-cased) address — safe to embed in a URL. */
export function signUnsubscribeToken(email: string): string {
  return createHmac("sha256", env.appSecret)
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  if (!email || !token) return false;
  const expected = Buffer.from(signUnsubscribeToken(email));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Absolute one-click unsubscribe URL for an email footer. */
export function buildUnsubscribeUrl(email: string): string {
  const base = env.appUrl.replace(/\/+$/, "");
  return `${base}/api/unsubscribe?email=${encodeURIComponent(email.trim().toLowerCase())}&token=${signUnsubscribeToken(email)}`;
}

const page = (title: string, body: string): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:48px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:14px;border:1px solid #E2E8F0;">
        <tr><td style="background:#4F46E5;padding:20px 24px;">
          <div style="font-size:20px;font-weight:800;color:#FFFFFF;">PHOJAA95</div>
        </td></tr>
        <tr><td style="padding:32px 28px;">
          <div style="font-size:18px;font-weight:700;color:#0F172A;margin-bottom:10px;">${title}</div>
          <div style="font-size:14px;color:#64748B;line-height:1.6;">${body}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

/**
 * GET /api/unsubscribe?email=…&token=…
 * Marks the client as unsubscribed (idempotent) and shows a confirmation page.
 * Unknown addresses still get the success page so the link can't be probed.
 */
export async function handleUnsubscribe(c: Context): Promise<Response> {
  const email = (c.req.query("email") || "").trim().toLowerCase();
  const token = c.req.query("token") || "";
  const invalid = page(
    "Link expired",
    "This unsubscribe link is not valid. If you keep receiving our emails, reply to the message and we will remove you manually.",
  );

  if (!verifyUnsubscribeToken(email, token)) return c.html(invalid);

  try {
    const db = getDb();
    const result = await db
      .update(clients)
      .set({ status: "unsubscribed" })
      .where(eq(clients.email, email));
    const affected = Number(result?.[0]?.affectedRows ?? 0);
    if (affected === 0) {
      logger.info("Unsubscribe: no matching client (already removed?)", { email });
    }
  } catch (err) {
    logger.error("Unsubscribe failed", { error: String(err), email });
    return c.html(
      page(
        "Something went wrong",
        "We could not process your request right now. Please try again in a moment or reply to the email for help.",
      ),
    );
  }

  return c.html(
    page(
      "You're unsubscribed",
      `<strong>${email}</strong> has been removed from our mailing list. You will not receive further campaign emails from us.`,
    ),
  );
}
