import { useState } from "react";
import type { ElementType } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, User, Calendar, Activity, PackageOpen, LogIn, Home, CheckCircle, XCircle, UserPlus, Key } from "lucide-react";
import { motion } from "framer-motion";

const actionColors: Record<string, string> = {
  LOGIN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30",
  PROPERTY_CREATED: "bg-primary/10 text-primary dark:bg-primary/20",
  PROPERTY_APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30",
  PROPERTY_REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30",
  STAFF_CREATED: "bg-violet-100 text-violet-700 dark:bg-violet-900/30",
  PASSWORD_RESET: "bg-amber-100 text-amber-700 dark:bg-amber-900/30",
};

const actionConfig: Record<string, { icon: ElementType; bg: string; text: string }> = {
  LOGIN: { icon: LogIn, bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-300" },
  PROPERTY_CREATED: { icon: Home, bg: "bg-primary/10 dark:bg-primary/20", text: "text-primary" },
  PROPERTY_APPROVED: { icon: CheckCircle, bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-600 dark:text-green-300" },
  PROPERTY_REJECTED: { icon: XCircle, bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-600 dark:text-red-300" },
  STAFF_CREATED: { icon: UserPlus, bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-600 dark:text-violet-300" },
  PASSWORD_RESET: { icon: Key, bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-300" },
};

function SummaryCard({ title, value, color, icon: Icon, delay = 0 }: { title: string; value: string | number; color: string; icon: ElementType; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}>
      <motion.div whileHover={{ y: -4 }} className="group relative overflow-hidden border-border/50 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
        <Card className="border-0 bg-transparent shadow-none">
          <div className={`absolute left-0 top-0 h-full w-1 ${color}`} />
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
                <h3 className="text-2xl font-black tracking-tight text-foreground">{value}</h3>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color} bg-opacity-10 dark:bg-opacity-20`}>
                <Icon className={`h-5 w-5 ${color.replace("bg-", "text-")}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export default function ActivityLogs() {
  const [search, setSearch] = useState("");
  const [page] = useState(1);

  const { data, isLoading } = trpc.activityLog.list.useQuery({
    page,
    limit: 50,
  });

  const filteredItems = data?.items.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.action?.toLowerCase().includes(q) ||
      item.userName?.toLowerCase().includes(q) ||
      item.entityType?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <Activity className="h-7 w-7 text-primary" />
          Activity Logs
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Audit trail of all system activities</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Total Logs" value={filteredItems?.length ?? 0} color="bg-primary" icon={Activity} delay={0} />
      </div>

      <Card className="border-border/50 bg-white/70 dark:bg-slate-800/70">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by action, user, or entity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-white/70 dark:bg-slate-800/70">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="border-border/50">
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {filteredItems?.map((log, index) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  {(() => {
                    const config = actionConfig[log.action || ""] || { icon: Activity, bg: "bg-slate-100 dark:bg-slate-700", text: "text-slate-500" };
                    const Icon = config.icon;
                    return (
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
                        <Icon className={`h-4 w-4 ${config.text}`} />
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${actionColors[log.action || ""] || "bg-slate-100 text-slate-700"} border-0 text-[10px]`}>
                        {log.action}
                      </Badge>
                      {log.entityType && (
                        <span className="text-xs text-muted-foreground">
                          {log.entityType}
                          {log.entityId ? ` #${log.entityId}` : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {log.userName || "System"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
                      </span>
                    </div>
                    {!!log.metadata && (
                      <p className="mt-1 text-xs text-muted-foreground truncate">
                        {typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata).slice(0, 100)}
                      </p>
                    )}
                  </div>
                </motion.div>
              )) || (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                  <Card className="border-0 bg-transparent shadow-none">
                    <CardContent className="py-20 text-center">
                      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5">
                        <PackageOpen className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <p className="text-lg font-bold text-foreground">No records found</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                        No activity logs match your search criteria.
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
