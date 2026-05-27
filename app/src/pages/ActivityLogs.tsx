import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText, Clock, User, Building2, Filter } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage, AnimatedSection } from "@/components/ui/animated-page";
import { AppleCard, AppleCardHeader, AppleCardTitle, AppleCardContent } from "@/components/ui/apple-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ActivityLogs() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const { data, isLoading } = trpc.activityLog.list.useQuery({
    search: search || undefined,
    action: actionFilter === "all" ? undefined : actionFilter,
    limit: 50,
  });

  const actionColors: Record<string, string> = {
    create: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    update: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    delete: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    approve: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    reject: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    login: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    logout: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };

  return (
    <AnimatedPage>
      <PageHeader
        title="Activity Logs"
        description="Track all system activities and changes"
        icon={<ScrollText className="h-5 w-5" />}
      />

      {/* Filters */}
      <div className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search activities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-1.5" />
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="approve">Approve</SelectItem>
              <SelectItem value="reject">Reject</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="logout">Logout</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Logs */}
      <AppleCard>
        <AppleCardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-full bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : data?.items?.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={ScrollText}
                title="No activity logs"
                description="No activities match your search criteria."
              />
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {data?.items?.map((log, index) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="flex items-start gap-3 p-4 hover:bg-muted/20 transition-colors"
                >
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${actionColors[log.action] || "bg-muted"}`}>
                    <ScrollText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{log.action}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${actionColors[log.action] || "bg-muted"}`}>
                        {log.entityType}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {log.description}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {log.userName || "System"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {log.createdAt ? format(new Date(log.createdAt), "MMM d, yyyy HH:mm") : ""}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AppleCardContent>
      </AppleCard>
    </AnimatedPage>
  );
}
