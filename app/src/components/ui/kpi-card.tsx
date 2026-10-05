import * as React from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { motion, useMotionValue, useSpring, useTransform, useInView } from "framer-motion";
import { AppleCard, AppleCardContent } from "./apple-card";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
  /** Rendered before the (animated) value — e.g. "Nu." for currency KPIs. */
  prefix?: string;
  suffix?: string;
  color?: string;
  delay?: number;
  className?: string;
}

/* Animated number: springs from 0 to the numeric target once in view.
   Non-numeric values (e.g. "Nu. 1.2L") render statically with fade-in. */
export function AnimatedValue({ value }: { value: string | number }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-24px" });
  const target = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.]/g, ""));
  const isNumeric = !isNaN(target) && /^\s*[\d,.]+(\.\d+)?\s*$/.test(String(value));

  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 20 });
  const display = useTransform(spring, (latest) =>
    isNumeric ? (Number.isInteger(target) ? Math.round(latest).toLocaleString() : latest.toFixed(2)) : ""
  );

  React.useEffect(() => {
    if (inView && isNumeric) mv.set(target);
  }, [inView, isNumeric, target, mv]);

  if (!isNumeric) {
    return <span ref={ref}>{value}</span>;
  }

  return (
    <span ref={ref}>
      <motion.span>{display}</motion.span>
    </span>
  );
}

/* Maps a Tailwind bg-* color class to a matching text-* for the icon chip. */
const chipStyles: Record<string, string> = {
  "bg-blue-500": "text-blue-600 dark:text-blue-300 bg-blue-500/10 dark:bg-blue-400/15 ring-blue-500/20 dark:ring-blue-400/20",
  "bg-emerald-500": "text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-400/15 ring-emerald-500/20 dark:ring-emerald-400/20",
  "bg-amber-500": "text-amber-600 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-400/15 ring-amber-500/20 dark:ring-amber-400/20",
  "bg-violet-500": "text-violet-600 dark:text-violet-300 bg-violet-500/10 dark:bg-violet-400/15 ring-violet-500/20 dark:ring-violet-400/20",
  "bg-red-500": "text-red-600 dark:text-red-300 bg-red-500/10 dark:bg-red-400/15 ring-red-500/20 dark:ring-red-400/20",
  "bg-rose-500": "text-rose-600 dark:text-rose-300 bg-rose-500/10 dark:bg-rose-400/15 ring-rose-500/20 dark:ring-rose-400/20",
  "bg-primary": "text-primary bg-primary/10 dark:bg-primary/15 ring-primary/20",
};

export function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
  subtitle,
  prefix,
  suffix,
  color = "bg-primary",
  delay = 0,
  className,
}: KPICardProps) {
  const chip = chipStyles[color] ?? chipStyles["bg-primary"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      <AppleCard hover className="group h-full overflow-hidden spotlight-card shine-sweep">
        {/* Top gradient hairline that brightens on hover */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-transparent via-current to-transparent opacity-30 group-hover:opacity-80 transition-opacity duration-300 pointer-events-none"
          style={{ color: "hsl(var(--primary))" }}
        />
        <AppleCardContent className="relative z-10 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2.5 min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {title}
              </p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums break-words">
                  {prefix && (
                    <span className="mr-1 align-middle text-[0.55em] font-semibold text-muted-foreground">{prefix}</span>
                  )}
                  <AnimatedValue value={value} />
                  {suffix && (
                    <span className="ml-1 align-middle text-[0.55em] font-semibold text-muted-foreground">{suffix}</span>
                  )}
                </h3>
                {trend && (
                  <span
                    className={cn(
                      "flex items-center text-xs font-semibold px-1.5 py-0.5 rounded-full",
                      trendUp
                        ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/20"
                        : "text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/20"
                    )}
                  >
                    {trendUp ? "↑" : "↓"} {trend}
                  </span>
                )}
              </div>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
            {/* Soft gradient icon chip — tinted, not solid, works in both themes */}
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset",
                "transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3",
                chip
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </AppleCardContent>
      </AppleCard>
    </motion.div>
  );
}

/*
 * KPIHeroCard — bento-style hero metric (2-col × 2-row span) with gradient
 * mesh background and an inline sparkline. Per ui-ux-pro-max bento spec:
 * varied card sizes, rounded-xl+, subtle shadows, hover scale.
 */
interface KPIHeroCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  subtitle?: string;
  trend?: string;
  trendUp?: boolean;
  sparkline?: number[];
  delay?: number;
  className?: string;
}

export function KPIHeroCard({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
  trendUp,
  sparkline,
  delay = 0,
  className,
}: KPIHeroCardProps) {
  const gradientId = useId().replace(/:/g, "");
  const hasSpark = Array.isArray(sparkline) && sparkline.length >= 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn("sm:col-span-2 lg:col-span-2 lg:row-span-2", className)}
    >
      <AppleCard hover className="group relative h-full overflow-hidden spotlight-card shine-sweep">
        {/* Gradient mesh ambience */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none transition-opacity duration-500 group-hover:opacity-80"
          style={{
            background:
              "radial-gradient(120% 100% at 100% 0%, hsl(var(--primary) / 0.14), transparent 60%), radial-gradient(80% 80% at 0% 100%, hsl(var(--chart-2) / 0.12), transparent 60%)",
          }}
        />
        <AppleCardContent className="relative z-10 flex h-full flex-col p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {title}
              </p>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground tabular-nums">
                  <AnimatedValue value={value} />
                </h3>
                {trend && (
                  <span
                    className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded-full",
                      trendUp
                        ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/25"
                        : "text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/25"
                    )}
                  >
                    {trendUp ? "↑" : "↓"} {trend}
                  </span>
                )}
              </div>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 dark:bg-primary/15 text-primary ring-1 ring-inset ring-primary/20 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
              <Icon className="h-5 w-5" />
            </div>
          </div>

          {/* Sparkline fills remaining space at the card bottom */}
          {hasSpark && (
            <div className="mt-auto pt-6 -mx-1 h-[72px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkline!.map((v, i) => ({ i, v }))}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    isAnimationActive
                    animationDuration={1200}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </AppleCardContent>
      </AppleCard>
    </motion.div>
  );
}
