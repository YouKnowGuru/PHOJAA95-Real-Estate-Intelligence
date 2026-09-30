import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, Users, CalendarDays, ArrowRight, BellRing, X } from "lucide-react";

/**
 * SalaryDuePopup — monthly "salary payment due" notice for admins.
 *
 * Rendered once inside AppLayout so it appears on EVERY screen. Backed by
 * push-router.salaryDueStatus which flips `seen` off again at the start of
 * the next month. Dismissing hides it for the rest of the month.
 *
 * This component also silently (re)subscribes the admin's browser to web
 * push on first load so payday reminders reach mobile/desktop even when the
 * app is closed. The browser's own permission prompt appears at most once
 * per device and only ever from an explicit user click.
 */
export function SalaryDuePopup() {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [pushState, setPushState] = useState<"idle" | "subscribed" | "default" | "denied" | "unsupported">("idle");
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  const utils = trpc.useUtils();
  const statusQuery = trpc.push.salaryDueStatus.useQuery(undefined, {
    enabled: isAdmin,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const dismissMutation = trpc.push.dismissSalaryNotice.useMutation({
    onSuccess: () => {
      utils.push.salaryDueStatus.invalidate().catch(() => {});
    },
  });

  const status = statusQuery.data;
  const hasPending = Boolean(status && (status.pendingCount > 0 || !status.hasRows));

  useEffect(() => {
    if (status && status.isDueDay && hasPending && !status.seen) {
      setOpen(true);
    }
  }, [status, hasPending]);

  // When the reminder is visible and push is not enabled yet, offer the
  // one-time opt-in inside the popup (never an unprompted permission dialog).
  useEffect(() => {
    if (open && pushState === "default") {
      const timer = setTimeout(() => setShowPushPrompt(true), 800);
      return () => clearTimeout(timer);
    }
  }, [open, pushState]);

  // Silently subscribe when the user has already granted permission. When it is
  // still "default", only ask later from inside an explicit click (enablePush).
  const subscribePush = trpc.push.saveSubscription.useMutation();
  const testPushMutation = trpc.push.sendTestPush.useMutation({
    onSuccess: () => toast.success("Test notification sent — check your device."),
    onError: (err) => toast.error(err.message || "Could not send test notification."),
  });
  const publicKeyQuery = trpc.push.publicKey.useQuery(undefined, { enabled: isAdmin, retry: false });

  useEffect(() => {
    if (!isAdmin || pushState !== "idle" || !publicKeyQuery.data?.key) return;
    let cancelled = false;
    (async () => {
      const mod = await import("@/lib/push-client");
      if (cancelled) return;
      if (mod.notificationPermission() === "granted") {
        const result = await mod.ensurePushSubscription(publicKeyQuery.data!.key);
        if (result.ok) {
          subscribePush.mutate({
            subscription: { endpoint: result.endpoint, keys: { p256dh: result.p256dh, auth: result.auth } },
          });
          setPushState("subscribed");
        }
      } else if (mod.notificationPermission() !== "unsupported") {
        setPushState("default");
      } else {
        setPushState("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, publicKeyQuery.data, pushState]);

  async function enablePush() {
    setShowPushPrompt(false);
    const mod = await import("@/lib/push-client");
    if (mod.notificationPermission() === "default") {
      try {
        await Notification.requestPermission();
      } catch { /* ignore */ }
    }
    const result = await mod.ensurePushSubscription(publicKeyQuery.data?.key ?? "");
    if (result.ok) {
      subscribePush.mutate({
        subscription: { endpoint: result.endpoint, keys: { p256dh: result.p256dh, auth: result.auth } },
      });
      setPushState("subscribed");
    } else if (result.reason === "denied") {
      setPushState("denied");
    }
  }

  function handleDismiss() {
    setOpen(false);
    dismissMutation.mutate();
  }

  if (!isAdmin || !status || !status.isDueDay || !hasPending || status.seen) return null;

  const monthLabel = new Date(
    Number(status.month.slice(0, 4)),
    Number(status.month.slice(5, 7)) - 1,
    1
  ).toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md border-amber-300/60 shadow-2xl shadow-amber-500/10 [&>button]:hidden">
        <DialogHeader className="space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30">
            <Wallet className="h-8 w-8 text-white" />
          </div>
          <DialogTitle className="text-center text-xl font-extrabold tracking-tight">
            Salary Payment Due
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            It is the <span className="font-semibold text-amber-600">30th</span> — staff salaries for{" "}
            <span className="font-semibold">{monthLabel}</span> need your attention.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-1">
          <div className="flex items-center justify-between rounded-lg border bg-amber-50/60 px-4 py-3 dark:bg-amber-950/30">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-amber-600" />
              {status.hasRows ? "Pending payments" : "Payroll status"}
            </div>
            <div className="text-sm font-bold tabular-nums">
              {status.hasRows ? `${status.pendingCount} staff` : "Not generated yet"}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-amber-50/60 px-4 py-3 dark:bg-amber-950/30">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarDays className="h-4 w-4 text-amber-600" />
              {status.hasRows ? "Total payable" : "Action"}
            </div>
            <div className="text-sm font-bold tabular-nums">
              {status.hasRows ? formatCurrency(status.totalNet) : "Review payroll"}
            </div>
          </div>
        </div>

        {showPushPrompt && pushState !== "subscribed" && (
          <div className="flex items-start justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2.5 text-xs dark:border-blue-900 dark:bg-blue-950/40">
            <div className="flex items-start gap-2">
              <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <span>
                Get this reminder on your <b>phone/desktop</b> even when this app is closed — enable
                notifications once per device.
              </span>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" className="h-7 px-2 text-xs" onClick={enablePush}>
                Enable
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => setShowPushPrompt(false)}
                aria-label="Skip enabling notifications"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {pushState === "subscribed" && (
          <button
            type="button"
            onClick={() => testPushMutation.mutate()}
            disabled={testPushMutation.isPending}
            className="w-full rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-60"
          >
            {testPushMutation.isPending
              ? "Sending test notification…"
              : "✓ Notifications enabled — send a test notification"}
          </button>
        )}

        {pushState === "denied" && (
          <p className="rounded-md bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
            Notifications are blocked in this browser. Enable them in site settings to get phone/desktop
            reminders.
          </p>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            asChild
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25 hover:from-amber-600 hover:to-orange-600"
          >
            <Link to="/payroll" onClick={handleDismiss}>
              Open Payroll
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" className="w-full" onClick={handleDismiss}>
            Dismiss for this month
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
