import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { payroll, pushSubscriptions, salaryNoticeLog } from "@db/schema";
import { sql } from "drizzle-orm";
import { getVapidPublicKey, sendPushToUser } from "./lib/push-service";

/**
 * Web-push infrastructure + salary-due notice status for the in-app popup.
 *
 * All of this is admin-only except `saveSubscription`, which any authenticated
 * local user needs to register their device.
 */
export const pushRouter = createRouter({
  /** VAPID public key the browser needs to subscribe (any signed-in user). */
  publicKey: authedQuery.query(async () => {
    return { key: await getVapidPublicKey() };
  }),

  /** Register/unregister this browser as a push target for the signed-in user. */
  saveSubscription: authedQuery
    .input(
      z.object({
        subscription: z.object({
          endpoint: z.string().min(1).max(512),
          keys: z.object({
            p256dh: z.string().min(1).max(255),
            auth: z.string().min(1).max(255),
          }),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;
      const { endpoint, keys } = input.subscription;
      const userAgent = (ctx.req?.headers?.get("user-agent") ?? "").slice(0, 255) || null;

      await db
        .insert(pushSubscriptions)
        .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent })
        .onDuplicateKeyUpdate({
          set: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent },
        });

      return { success: true };
    }),

  removeSubscription: authedQuery
    .input(z.object({ endpoint: z.string().min(1).max(512) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.endpoint, input.endpoint), eq(pushSubscriptions.userId, ctx.unifiedUser!.id)));
      return { success: true };
    }),

  /**
   * Popup state for the salary-due banner shown on every admin screen:
   * - due: true when today is payday (30th / last day of month) and salaries are pending
   * - dismissed: false while the admin's snooze (last dismissal) is older than 30 min —
   *   the popup keeps coming back until salaries are actually paid.
   */
  salaryDueStatus: adminQuery.query(async ({ ctx }) => {
    const db = getDb();
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const configured = parseInt(process.env.SALARY_DUE_DAY || "30", 10);
    const dueDay = Math.min(Math.max(isNaN(configured) ? 30 : configured, 1), 31);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const isDueDay = now.getDate() >= Math.min(dueDay, lastDay);

    // Check whether this month's payroll exists and has pending payments.
    const [due] = await db
      .select({
        totalRows: sql<number>`COUNT(*)`,
        pendingCount: sql<number>`SUM(CASE WHEN ${payroll.paymentStatus} = 'pending' THEN 1 ELSE 0 END)`,
        totalNet: sql<string>`COALESCE(SUM(CASE WHEN ${payroll.paymentStatus} = 'pending' THEN ${payroll.netSalary} ELSE 0 END), 0)`,
      })
      .from(payroll)
      .where(eq(payroll.month, month));

    const pendingCount = Number(due?.pendingCount ?? 0);
    const hasRows = Number(due?.totalRows ?? 0) > 0;

    const existing = await db
      .select()
      .from(salaryNoticeLog)
      .where(and(eq(salaryNoticeLog.userId, ctx.unifiedUser!.id), eq(salaryNoticeLog.month, month)))
      .limit(1);

    // Auto-create the log row so dismiss-state persists per admin per month.
    if (existing.length === 0 && isDueDay && (!hasRows || pendingCount > 0)) {
      await db.insert(salaryNoticeLog).values({ userId: ctx.unifiedUser!.id, month });
    }

    // Snooze window: after dismissing, hide the popup for 30 minutes.
    // It then re-appears on the next screen/navigation until payroll is paid.
    const SNOOZE_MS = 30 * 60 * 1000;
    const seenAt = existing[0]?.seenAt ? new Date(existing[0].seenAt).getTime() : 0;
    const snoozed = seenAt > 0 && Date.now() - seenAt < SNOOZE_MS;

    return {
      isDueDay,
      month,
      pendingCount,
      totalNet: String(due?.totalNet ?? "0"),
      hasRows,
      dismissed: snoozed,
    };
  }),

  /**
   * Admin dismisses the popup — a 30-minute snooze, NOT a permanent dismiss.
   * The reminder keeps returning until this month's salaries are paid.
   */
  dismissSalaryNotice: adminQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await db
      .update(salaryNoticeLog)
      .set({ seenAt: new Date() })
      .where(and(eq(salaryNoticeLog.userId, ctx.unifiedUser!.id), eq(salaryNoticeLog.month, month)));
    return { success: true };
  }),

  /** Send a test push to every device of the signed-in admin (verification). */
  sendTestPush: adminQuery.mutation(async ({ ctx }) => {
    const delivered = await sendPushToUser(ctx.unifiedUser!.id, {
      title: "🔔 PHOJAA95 test notification",
      body: "Push notifications are working! Salary reminders will appear like this on payday.",
      tag: "phojaa95-test",
      url: "/",
    });
    if (delivered === 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No subscribed device found. Enable notifications first (allow the browser prompt).",
      });
    }
    return { success: true, delivered };
  }),
});
