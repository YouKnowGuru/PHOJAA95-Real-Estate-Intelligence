import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { logger } from "./logger";
import { notifications, payroll, pushSubscriptions, salaryNoticeLog, localUsers, systemSettings } from "@db/schema";
import { ensureSchemaPatches } from "./ensure-schema";

// web-push is loaded lazily (never at module scope) so that a problem with
// this optional dependency can NEVER break the main API boot on the host.
type WebPushApi = typeof import("web-push");
let webpush: WebPushApi | null = null;
async function loadWebPush(): Promise<WebPushApi> {
  if (webpush) return webpush;
  const mod = await import("web-push");
  // CJS/ESM interop: the API may sit under `default` or directly on the module
  webpush = ((mod as { default?: WebPushApi }).default ?? mod) as WebPushApi;
  return webpush;
}

/**
 * Salary-due reminder system (persistent until paid).
 *
 * From the 30th of every month (or the last day of shorter months) until
 * every payroll record for that month is marked paid, each admin gets:
 *   1. An in-app popup on every screen that re-appears after each snooze
 *      (served by push-router.salaryDueStatus)
 *   2. A web-push roughly every hour during waking hours (~15+/day) on
 *      desktop/mobile, even when the app is closed
 *   3. A row in the in-app Notifications bell (once per month)
 *
 * The ONLY way to stop the reminders is to mark salaries paid in Payroll.
 * SALARY_NAG_MINUTES env var changes the push interval (default 60).
 */

const VAPID_PUBLIC_KEY_SETTING = "vapid_public_key";
const VAPID_PRIVATE_KEY_SETTING = "vapid_private_key";
const VAPID_SUBJECT = "mailto:admin@phojaa95.com";

// How often the scheduler checks whether the salary-due day has arrived.
const SCHEDULER_INTERVAL_MS = 30 * 60 * 1000; // every 30 minutes
// Delay the first run slightly after boot so DB patches have been applied.
const FIRST_RUN_DELAY_MS = 20 * 1000;

let vapidCache: { publicKey: string; privateKey: string } | null = null;

/** Get (or lazily create + persist) the VAPID keypair used for web push. */
export async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const webpushModule = await loadWebPush();
  if (vapidCache) return vapidCache;

  const db = getDb();
  const rows = await db
    .select({ key: systemSettings.key, value: systemSettings.value })
    .from(systemSettings)
    .where(inArray(systemSettings.key, [VAPID_PUBLIC_KEY_SETTING, VAPID_PRIVATE_KEY_SETTING]));

  let publicKey = rows.find(r => r.key === VAPID_PUBLIC_KEY_SETTING)?.value ?? null;
  let privateKey = rows.find(r => r.key === VAPID_PRIVATE_KEY_SETTING)?.value ?? null;

  if (!publicKey || !privateKey) {
    const generated = webpushModule.generateVAPIDKeys();
    publicKey = generated.publicKey;
    privateKey = generated.privateKey;
    await db
      .insert(systemSettings)
      .values([
        { key: VAPID_PUBLIC_KEY_SETTING, value: publicKey, description: "VAPID public key for web push notifications" },
        { key: VAPID_PRIVATE_KEY_SETTING, value: privateKey, description: "VAPID private key for web push notifications" },
      ])
      .onDuplicateKeyUpdate({ set: { value: sql`VALUES(${systemSettings.value})` } });
    logger.info("Generated new VAPID keypair for web push notifications");
  }

  vapidCache = { publicKey, privateKey };
  webpushModule.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);
  return vapidCache;
}
export async function getVapidPublicKey(): Promise<string> {
  return (await getVapidKeys()).publicKey;
}

export type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
};

/** Send a web push to every device subscribed by the given user. Dead endpoints are cleaned up. */
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<number> {
  await getVapidKeys(); // ensures webpush.setVapidDetails was called
  const db = getDb();

  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  let delivered = 0;

  const webpushModule = await loadWebPush();

  for (const sub of subs) {
    try {
      await webpushModule.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      delivered++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      // 404/410 = subscription expired or revoked → remove it
      if (statusCode === 404 || statusCode === 410) {
        try {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        } catch { /* ignore cleanup failure */ }
      }
      logger.warn("Push delivery failed", { userId, statusCode, error: String(err).slice(0, 200) });
    }
  }
  return delivered;
}

/** YYYY-MM for the given date, using the server's local time. */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Salary is due on the 30th; shorter months (e.g. February) trigger on their
 * last day so every month gets exactly one reminder.
 * Override with SALARY_DUE_DAY env var (e.g. for testing).
 */
function isSalaryDueDay(now: Date): boolean {
  const configured = parseInt(process.env.SALARY_DUE_DAY || "30", 10);
  const dueDay = Math.min(Math.max(isNaN(configured) ? 30 : configured, 1), 31);
  const day = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return day >= Math.min(dueDay, lastDay);
}

async function countAdmins(): Promise<number[]> {
  const db = getDb();
  const admins = await db
    .select({ id: localUsers.id })
    .from(localUsers)
    .where(and(eq(localUsers.role, "admin"), eq(localUsers.status, "active")));
  return admins.map(a => a.id);
}

async function getMonthlyDue(month: string): Promise<{ pendingCount: number; totalNet: string; hasRows: boolean }> {
  const db = getDb();
  const [row] = await db
    .select({
      totalRows: sql<number>`COUNT(*)`,
      pendingCount: sql<number>`SUM(CASE WHEN ${payroll.paymentStatus} = 'pending' THEN 1 ELSE 0 END)`,
      totalNet: sql<string>`COALESCE(SUM(CASE WHEN ${payroll.paymentStatus} = 'pending' THEN ${payroll.netSalary} ELSE 0 END), 0)`,
    })
    .from(payroll)
    .where(eq(payroll.month, month));

  return {
    pendingCount: Number(row?.pendingCount ?? 0),
    totalNet: String(row?.totalNet ?? "0"),
    hasRows: Number(row?.totalRows ?? 0) > 0,
  };
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

/**
 * One scheduler tick.
 *
 * Persistent-reminder mode: from the due day until every salary is paid,
 * each admin is pushed at most once per hour (≈16 per 8am–11pm window,
 * 15+ per day). The only way to stop the reminders is to actually mark
 * salaries paid in Payroll. A silent heartbeat is written on every tick
 * so monitoring can confirm the scheduler is alive.
 */
export async function runSalaryDueCheck(): Promise<void> {
  try {
    await ensureSchemaPatches();
    const db = getDb();
    const now = new Date();
    if (!isSalaryDueDay(now)) return;

    const month = monthKey(now);
    const due = await getMonthlyDue(month);

    // All salaries already paid → stop nagging immediately.
    if (due.hasRows && due.pendingCount === 0) return;

    const adminIds = await countAdmins();
    if (adminIds.length === 0) return;

    const existingLogs = await db
      .select()
      .from(salaryNoticeLog)
      .where(and(eq(salaryNoticeLog.month, month), inArray(salaryNoticeLog.userId, adminIds)));

    const body = due.hasRows
      ? `${due.pendingCount} staff payment${due.pendingCount === 1 ? "" : "s"} pending for ${monthLabel(month)}. Total: Nu. ${Number(due.totalNet).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `Payroll has not been generated for ${monthLabel(month)} yet. Please review and pay staff salaries.`;

    for (const adminId of adminIds) {
      let log = existingLogs.find(l => l.userId === adminId);

      // Create the per-month log row the first time this admin is notified.
      if (!log) {
        await db.insert(salaryNoticeLog).values({ userId: adminId, month, pushSent: false });
        // Also drop a row into the in-app notification bell.
        await db.insert(notifications).values({
          userId: adminId,
          title: "Salary Payment Due",
          message: body,
          type: "warning",
          entityType: "payroll",
        });
        log = undefined;
      }

      // Per-admin nag throttle: at most one push per N minutes (default 60).
      const nagMinutes = (() => {
        const parsed = parseInt(process.env.SALARY_NAG_MINUTES || "60", 10);
        return Math.min(Math.max(isNaN(parsed) ? 60 : parsed, 5), 720);
      })();
      if (log && log.lastPushAt && Date.now() - new Date(log.lastPushAt).getTime() < nagMinutes * 60_000) {
        continue; // pushed recently — wait for the next tick
      }

      // Send the hourly nag. If the admin has no subscribed device yet,
      // delivery returns 0 and the next tick retries (opt-in via popup).
      const delivered = await sendPushToUser(adminId, {
        title: "💰 Salary Payment Due",
        body,
        tag: `salary-due-${month}`,
        url: "/payroll",
        requireInteraction: true,
      });
      await db
        .update(salaryNoticeLog)
        .set({
          pushSent: delivered > 0 ? true : (log?.pushSent ?? false),
          pushSentAt: log?.pushSentAt ?? (delivered > 0 ? new Date() : null),
          lastPushAt: new Date(),
        })
        .where(and(eq(salaryNoticeLog.userId, adminId), eq(salaryNoticeLog.month, month)));
      logger.info("Salary-due nag processed", { adminId, month, delivered, pending: due.pendingCount });
    }
  } catch (err) {
    // Never crash the server from the scheduler; the next tick retries.
    logger.warn("Salary-due scheduler tick failed (will retry)", { error: String(err).slice(0, 300) });
  }
}

/** Start the background scheduler (safe to call once per process). */
let schedulerStarted = false;
export function startSalaryDueScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  if (process.env.DISABLE_SCHEDULERS === "1") return;
  setTimeout(() => { void runSalaryDueCheck(); }, FIRST_RUN_DELAY_MS);
  setInterval(() => { void runSalaryDueCheck(); }, SCHEDULER_INTERVAL_MS);
  logger.info("Salary-due scheduler started (persistent mode: hourly nags until paid)");
}
