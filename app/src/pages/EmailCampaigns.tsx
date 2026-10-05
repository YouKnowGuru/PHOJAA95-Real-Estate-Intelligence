import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Mail,
  Send,
  Search,
  Eye,
  X,
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  History,
  Sparkles,
  MapPin,
  Banknote,
  Check,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage } from "@/components/ui/animated-page";
import { AppleCard, AppleCardContent } from "@/components/ui/apple-card";
import { KPICard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const VARIABLES = [
  { token: "{{clientName}}", label: "Client name" },
  { token: "{{propertyName}}", label: "Property" },
  { token: "{{price}}", label: "Price" },
  { token: "{{address}}", label: "Address" },
  { token: "{{siteName}}", label: "Site name" },
];

const DEFAULT_SUBJECT = "New property listing from {{siteName}} — {{propertyName}}";

const MAX_PROPERTIES = 10; // per campaign (server-enforced too)
const SEND_CHUNK = 20; // recipients per request so progress stays live
const RECIPIENT_PAGE = 50; // rows rendered before "Show more"

export default function EmailCampaigns() {
  const utils = trpc.useUtils();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState("compose");

  // ── Property picker (multi-select) ─────────────────────────────────
  const [propertySearch, setPropertySearch] = useState("");
  const [debouncedPropertySearch, setDebouncedPropertySearch] = useState("");
  const [propertyIds, setPropertyIds] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPropertySearch(propertySearch), 300);
    return () => clearTimeout(t);
  }, [propertySearch]);

  // Preselect when arriving from a property card / detail page
  useEffect(() => {
    const preselect = Number(searchParams.get("propertyId"));
    if (Number.isFinite(preselect) && preselect > 0) {
      setPropertyIds((prev) => (prev.includes(preselect) ? prev : [...prev, preselect]));
    }
  }, [searchParams]);

  const { data: propertyResults, isLoading: loadingProperties } =
    trpc.email.searchProperties.useQuery(
      { search: debouncedPropertySearch || undefined, limit: 8 },
      {},
    );

  // Full card data for every selected property (order preserved by the server).
  const { data: selectedProperties, isLoading: loadingSelected } =
    trpc.email.getProperties.useQuery(
      { ids: propertyIds },
      { enabled: propertyIds.length > 0 },
    );

  // Selected ids that the server couldn't resolve (deleted since selection).
  const missingPropertyIds =
    propertyIds.length > 0 && !loadingSelected && selectedProperties
      ? propertyIds.filter((id) => !selectedProperties.some((p) => p.id === id))
      : [];

  const addProperty = (id: number) => {
    setPropertyIds((prev) => {
      if (prev.includes(id)) {
        toast.info("That property is already selected.");
        return prev;
      }
      if (prev.length >= MAX_PROPERTIES) {
        toast.error(`Up to ${MAX_PROPERTIES} properties per campaign.`);
        return prev;
      }
      return [...prev, id];
    });
  };
  const removeProperty = (id: number) =>
    setPropertyIds((prev) => prev.filter((p) => p !== id));
  const clearProperties = () => setPropertyIds([]);

  // ── Message ────────────────────────────────────────────────────────
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(
    "We are pleased to share a new property from our portfolio.\n\nPlease find the details below. If you or someone you know is interested, reply to this email and we will arrange a viewing.",
  );
  const [includeProperty, setIncludeProperty] = useState(true);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  // Chips insert into whichever field the user last focused (subject or body).
  const lastFieldRef = useRef<"body" | "subject">("body");

  /** Insert a variable at the caret of the last-focused field (append when none is focused). */
  const insertVariable = (token: string) => {
    const target = lastFieldRef.current;
    const el = target === "subject" ? subjectRef.current : bodyRef.current;
    // Only trust the caret while the field is genuinely focused — a stale
    // selection (e.g. after a re-render) would splice tokens mid-text.
    if (!el || document.activeElement !== el) {
      if (target === "subject") setSubject((s) => `${s}${token}`);
      else setBody((b) => `${b}${token}`);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const apply = (prev: string) => `${prev.slice(0, start)}${token}${prev.slice(end)}`;
    if (target === "subject") setSubject(apply);
    else setBody(apply);
    // Restore the caret just after the inserted token.
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  // ── Recipients ─────────────────────────────────────────────────────
  const [clientSearch, setClientSearch] = useState("");
  const [clientGroup, setClientGroup] = useState("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data: clientData, isLoading: loadingClients } = trpc.clients.list.useQuery({});
  const { data: groups } = trpc.clients.groups.useQuery();
  const allClients = (clientData?.rows ?? []) as Array<{
    id: number;
    fullName: string;
    email: string;
    phone: string | null;
    groupName: string;
    status: "active" | "unsubscribed";
  }>;

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    return allClients.filter((c) => {
      if (clientGroup !== "all" && c.groupName !== clientGroup) return false;
      if (!q) return true;
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.groupName.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [allClients, clientSearch, clientGroup]);

  const activeFiltered = filteredClients.filter((c) => c.status === "active");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleClient = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      activeFiltered.forEach((c) => next.add(c.id));
      return [...next];
    });
  };

  const clearSelection = () => setSelectedIds([]);

  // Windowing: render the first page and let the user pull more.
  const [visibleCount, setVisibleCount] = useState(RECIPIENT_PAGE);
  useEffect(() => {
    setVisibleCount(RECIPIENT_PAGE);
  }, [clientSearch, clientGroup]);
  const visibleClients = filteredClients.slice(0, visibleCount);
  const activeCount = allClients.filter((c) => c.status === "active").length;
  const selectedClients = selectedIds
    .map((id) => allClients.find((c) => c.id === id))
    .filter((c): c is (typeof allClients)[number] => Boolean(c));

  // ── Status / mutations ─────────────────────────────────────────────
  const { data: smtp } = trpc.email.status.useQuery();

  const previewMutation = trpc.email.preview.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const [showPreview, setShowPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [lastResult, setLastResult] = useState<{
    sent: number;
    failed: number;
    total: number;
  } | null>(null);

  const sendMutation = trpc.email.sendCampaign.useMutation();
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{
    sent: number;
    failed: number;
    total: number;
    done: number;
    chunks: number;
  } | null>(null);

  /** Send in chunks so the UI shows live progress and no request runs too long. */
  const runSend = async () => {
    const clientIds = selectedIds;
    if (!clientIds.length) return;
    const total = clientIds.length;
    setSending(true);
    setSendProgress({ sent: 0, failed: 0, total, done: 0, chunks: Math.ceil(total / SEND_CHUNK) });
    let sent = 0;
    let failed = 0;
    try {
      for (let i = 0; i < clientIds.length; i += SEND_CHUNK) {
        const res = await sendMutation.mutateAsync({
          subject,
          body,
          propertyIds,
          includeProperty: includeProperty && propertyIds.length > 0,
          clientIds: clientIds.slice(i, i + SEND_CHUNK),
        });
        sent += res.sent;
        failed += res.failed;
        setSendProgress((p) => (p ? { ...p, sent, failed, done: p.done + 1 } : p));
      }
      setShowConfirm(false);
      setSelectedIds([]);
      setLastResult({ sent, failed, total });
      utils.email.history.invalidate();
      utils.email.historyStats.invalidate();
      toast.success(`Sent ${sent} email${sent === 1 ? "" : "s"}`, {
        description: failed ? `${failed} failed — see History for details` : undefined,
      });
      setTab("history");
    } catch (err) {
      setShowConfirm(false);
      toast.error(
        err instanceof Error ? err.message : "Sending failed. Check History for progress.",
      );
      if (sent + failed > 0) {
        utils.email.history.invalidate();
        utils.email.historyStats.invalidate();
      }
    } finally {
      setSending(false);
      setSendProgress(null);
    }
  };

  // ── History ────────────────────────────────────────────────────────
  const [historySearch, setHistorySearch] = useState("");
  const [historySearchDebounced, setHistorySearchDebounced] = useState("");
  const [historyStatus, setHistoryStatus] = useState("all");

  // Debounce so typing doesn't fire a server query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setHistorySearchDebounced(historySearch), 300);
    return () => clearTimeout(t);
  }, [historySearch]);

  const { data: history, isLoading: loadingHistory } = trpc.email.history.useQuery({
    search: historySearchDebounced || undefined,
    status: historyStatus !== "all" ? (historyStatus as "sent" | "failed") : undefined,
    limit: 100,
  });
  const historyRows = history ?? [];

  // Accurate all-time counts (the list above is capped at 100 rows).
  const { data: historyStats } = trpc.email.historyStats.useQuery();
  const historySent = historyStats?.sent ?? historyRows.filter((r) => r.status === "sent").length;
  const historyFailed = historyStats?.failed ?? historyRows.length - historySent;
  const historyTotal = historyStats?.total ?? historyRows.length;

  const openPreview = () => {
    previewMutation.mutate(
      { subject, body, propertyIds, includeProperty: includeProperty && propertyIds.length > 0 },
      { onSuccess: (res) => { setShowPreview(true); return res; } },
    );
  };

  const canSend =
    Boolean(subject.trim()) && selectedIds.length > 0 && smtp?.configured !== false && !sending;

  return (
    <AnimatedPage>
      <PageHeader
        title="Email Campaigns"
        description="Load a property, choose your clients and send a branded email blast"
        icon={<Mail className="h-5 w-5" />}
      />

      {/* SMTP status banner */}
      {smtp && !smtp.configured && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-start gap-3"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <span className="font-semibold">SMTP is not configured.</span> Set{" "}
            <code className="px-1 rounded bg-amber-100 dark:bg-amber-900">SMTP_HOST</code>,{" "}
            <code className="px-1 rounded bg-amber-100 dark:bg-amber-900">SMTP_USER</code> and{" "}
            <code className="px-1 rounded bg-amber-100 dark:bg-amber-900">SMTP_PASS</code> on the
            server to enable sending.
          </div>
        </motion.div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="compose" className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Compose
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            History
          </TabsTrigger>
        </TabsList>

        {/* ───────────────────────── COMPOSE ───────────────────────── */}
        <TabsContent value="compose" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="space-y-6 min-w-0">
              {/* Property picker */}
              <AppleCard hover={false}>
                <AppleCardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">1 · Properties</h3>
                    </div>
                    {propertyIds.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-primary/10 text-primary border-0">
                          {propertyIds.length}/{MAX_PROPERTIES}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={clearProperties}
                        >
                          <X className="h-3 w-3" />
                          Clear all
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Selected properties, stacked in pick order */}
                  {loadingSelected && <Skeleton className="h-20 rounded-xl" />}
                  {selectedProperties?.map((p) => (
                    <div
                      key={p.id}
                      className="flex gap-3 rounded-xl border border-border/60 overflow-hidden"
                    >
                      <div className="h-20 w-28 shrink-0 bg-slate-100 dark:bg-slate-800">
                        {p.imageUrls?.[0] && (
                          <img src={p.imageUrls[0]} alt={p.name} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="py-2.5 pr-2.5 min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{p.address}</span>
                        </p>
                        <p className="text-sm font-bold text-primary flex items-center gap-1 mt-0.5">
                          <Banknote className="h-3 w-3" />
                          Nu. {p.price}
                        </p>
                      </div>
                      <button
                        type="button"
                        title="Remove"
                        className="p-1.5 m-1 self-start rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => removeProperty(p.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Requested ids that no longer exist (deleted since selection) */}
                {missingPropertyIds.length > 0 && (
                  <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <div className="text-sm text-amber-800 dark:text-amber-200 flex-1">
                      <span className="font-semibold">
                        {missingPropertyIds.length === 1 ? "Property" : `${missingPropertyIds.length} properties`} not found.
                      </span>{" "}
                      It may have been deleted — remove it or pick another one below.
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setPropertyIds(missingPropertyIds.length === propertyIds.length ? [] : propertyIds.filter((id) => !missingPropertyIds.includes(id)))}
                    >
                      Remove
                    </Button>
                  </div>
                )}

                  {/* Picker — stays open so several properties can be added in a row */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input
                        value={propertySearch}
                        onChange={(e) => {
                          setPropertySearch(e.target.value);
                          setPickerOpen(true);
                        }}
                        onFocus={() => setPickerOpen(true)}
                        onKeyDown={(e) => e.key === "Escape" && setPickerOpen(false)}
                        placeholder={propertyIds.length ? "Add another property..." : "Search properties by name or address..."}
                        className="pl-10"
                      />
                    </div>
                    {pickerOpen && (
                      <div className="rounded-xl border border-border/60 max-h-64 overflow-y-auto divide-y divide-border/40">
                        {loadingProperties ? (
                          <div className="p-3">
                            <Skeleton className="h-10 w-full" />
                          </div>
                        ) : propertyResults?.length ? (
                          propertyResults.map((p) => {
                            const chosen = propertyIds.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                className={`w-full flex items-center gap-3 p-2.5 text-left transition-colors ${
                                  chosen
                                    ? "bg-primary/5 cursor-default"
                                    : "hover:bg-muted/60"
                                }`}
                                onClick={() => !chosen && addProperty(p.id)}
                              >
                                <div className="h-10 w-14 rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                                  {p.coverImage && (
                                    <img
                                      src={p.coverImage}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium truncate">{p.propertyName}</p>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {p.address}
                                  </p>
                                </div>
                                {chosen ? (
                                  <span className="text-primary shrink-0">
                                    <Check className="h-4 w-4" />
                                  </span>
                                ) : (
                                  <span className="text-xs font-semibold text-primary shrink-0">
                                    Nu. {p.price}
                                  </span>
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <p className="p-4 text-xs text-muted-foreground text-center">
                            No properties found.
                          </p>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {propertyIds.length
                        ? "Click results to add more — every selected property gets its own card in the email."
                        : "Optional — pick one or more properties to embed in the email."}
                    </p>
                  </div>
                </AppleCardContent>
              </AppleCard>

              {/* Message */}
              <AppleCard hover={false}>
                <AppleCardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">2 · Message</h3>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Subject *</Label>
                      <span
                        className={`text-[10px] ${
                          subject.length > 450 ? "text-amber-600" : "text-muted-foreground"
                        }`}
                      >
                        {subject.length}/500
                      </span>
                    </div>
                    <Input
                      ref={subjectRef}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      onFocus={() => (lastFieldRef.current = "subject")}
                      maxLength={500}
                      placeholder="Email subject"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Body</Label>
                      <div className="flex flex-wrap gap-1">
                        {VARIABLES.map((v) => (
                          <button
                            key={v.token}
                            type="button"
                            title={`Insert ${v.label}`}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => insertVariable(v.token)}
                          >
                            {v.token}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Textarea
                      ref={bodyRef}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      onFocus={() => (lastFieldRef.current = "body")}
                      rows={7}
                      placeholder="Write your message..."
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Variables are replaced per recipient — property tokens use the first selected
                      property. Newlines become paragraph breaks.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={includeProperty}
                      onCheckedChange={(v) => setIncludeProperty(v === true)}
                      disabled={!propertyIds.length}
                    />
                    Include property cards (image, price, features — one per property)
                  </label>
                </AppleCardContent>
              </AppleCard>
            </div>

            {/* Recipients */}
            <AppleCard hover={false} className="lg:sticky lg:top-6 self-start">
              <AppleCardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">3 · Recipients</h3>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-0">
                    {selectedIds.length} selected
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Search clients..."
                      className="pl-10 h-9"
                    />
                  </div>
                  <Select value={clientGroup} onValueChange={setClientGroup}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All groups" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All groups</SelectItem>
                      {groups?.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      className="text-primary hover:underline disabled:opacity-40"
                      onClick={selectAllVisible}
                      disabled={!activeFiltered.length}
                    >
                      Select all shown ({activeFiltered.length})
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                      onClick={clearSelection}
                      disabled={!selectedIds.length}
                    >
                      Clear
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {activeCount} active · {filteredClients.length} shown
                  </p>
                </div>

                {/* Selected clients stay visible as chips, even when filtered away */}
                {selectedClients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {selectedClients.map((c) => (
                      <span
                        key={c.id}
                        title={`${c.fullName} · ${c.email}`}
                        className="inline-flex items-center gap-1 max-w-full rounded-full bg-primary/10 text-primary pl-2.5 pr-1 py-0.5 text-[11px]"
                      >
                        <span className="truncate max-w-[130px]">{c.fullName}</span>
                        <button
                          type="button"
                          className="rounded-full p-0.5 hover:bg-primary/20"
                          onClick={() => toggleClient(c.id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="max-h-[380px] overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40">
                  {loadingClients ? (
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : filteredClients.length ? (
                    visibleClients.map((c) => {
                      const disabled = c.status !== "active";
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2.5 p-2.5 ${
                            disabled ? "opacity-50" : "hover:bg-muted/60 cursor-pointer"
                          } transition-colors`}
                        >
                          <Checkbox
                            checked={selectedSet.has(c.id)}
                            onCheckedChange={() => toggleClient(c.id)}
                            disabled={disabled}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{c.fullName}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{c.email}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {c.groupName}
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="p-4 text-xs text-muted-foreground text-center">
                      No clients match. Add clients in the{" "}
                      <span className="text-primary font-medium">Clients</span> page.
                    </p>
                  )}
                </div>

                {filteredClients.length > visibleClients.length && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setVisibleCount((n) => n + RECIPIENT_PAGE)}
                  >
                    Show {Math.min(RECIPIENT_PAGE, filteredClients.length - visibleClients.length)} more
                    of {filteredClients.length}
                  </Button>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={openPreview}
                    disabled={previewMutation.isPending}
                  >
                    <Eye className="h-4 w-4 mr-1.5" />
                    {previewMutation.isPending ? "Rendering..." : "Preview"}
                  </Button>
                  <Button
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={!canSend}
                    onClick={() => setShowConfirm(true)}
                  >
                    <Send className="h-4 w-4 mr-1.5" />
                    Send {selectedIds.length > 0 ? `to ${selectedIds.length}` : ""}
                  </Button>
                </div>
                {!smtp?.configured && (
                  <p className="text-[11px] text-amber-600 text-center">
                    Sending is disabled until SMTP is configured.
                  </p>
                )}
              </AppleCardContent>
            </AppleCard>
          </div>
        </TabsContent>

        {/* ───────────────────────── HISTORY ───────────────────────── */}
        <TabsContent value="history" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <KPICard
              title="Total Emails"
              value={historyTotal}
              icon={Mail}
              color="bg-primary"
              delay={0}
            />
            <KPICard
              title="Sent"
              value={historySent}
              icon={CheckCircle2}
              color="bg-emerald-500"
              delay={0.1}
            />
            <KPICard
              title="Failed"
              value={historyFailed}
              icon={AlertTriangle}
              color="bg-red-500"
              delay={0.2}
            />
          </div>

          <FilterBar
            searchValue={historySearch}
            onSearchChange={setHistorySearch}
            searchPlaceholder="Search subject, recipient..."
            hasActiveFilters={Boolean(historySearch) || historyStatus !== "all"}
            onClearFilters={() => {
              setHistorySearch("");
              setHistoryStatus("all");
            }}
            filters={
              <Select value={historyStatus} onValueChange={setHistoryStatus}>
                <SelectTrigger className="w-full sm:w-40 h-10">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            }
          />

          {loadingHistory ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </div>
          ) : historyRows.length === 0 ? (
            <EmptyState
              icon={History}
              title="No emails sent yet"
              description="Compose your first campaign and it will appear here."
            />
          ) : (
            <div className="space-y-3">
              {historyRows.map((row, index) => (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.02, 0.3) }}
                >
                  <AppleCard hover={false}>
                    <AppleCardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{row.subject}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          To: {row.toName ? `${row.toName} · ` : ""}
                          {row.toEmail}
                          {row.sentByName ? ` · by ${row.sentByName}` : ""}
                        </p>
                        {row.status === "failed" && row.error && (
                          <p className="text-[11px] text-red-500 truncate mt-1">{row.error}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-muted-foreground">
                          {row.createdAt ? format(new Date(row.createdAt), "dd MMM yyyy, HH:mm") : ""}
                        </span>
                        <StatusBadge
                          variant={row.status === "sent" ? "success" : "error"}
                          dot
                        >
                          {row.status === "sent" ? "Sent" : "Failed"}
                        </StatusBadge>
                      </div>
                    </AppleCardContent>
                  </AppleCard>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Preview dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="rounded-2xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Rendered exactly as recipients will receive it (sample recipient: Pema Wangmo).
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border/60 overflow-hidden bg-slate-100 dark:bg-slate-900">
            {previewMutation.data ? (
              <iframe
                title="Email preview"
                srcDoc={previewMutation.data.html}
                className="w-full h-[65vh]"
              />
            ) : (
              <div className="p-6 text-sm text-muted-foreground">Rendering preview...</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm send dialog */}
      <Dialog
        open={showConfirm}
        onOpenChange={(open) => {
          if (!open && sending) return; // don't close mid-send
          setShowConfirm(open);
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{sending ? "Sending campaign…" : "Send this campaign?"}</DialogTitle>
            <DialogDescription>
              {sending
                ? "Emails are going out in small batches. Keep this dialog open until it finishes."
                : `This will send ${selectedIds.length} email${selectedIds.length === 1 ? "" : "s"} immediately. Delivery results are recorded in History.`}
            </DialogDescription>
          </DialogHeader>
          {sending && sendProgress ? (
            <div className="space-y-3">
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.round((sendProgress.done / sendProgress.chunks) * 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 py-2">
                  <p className="font-bold text-emerald-600">{sendProgress.sent}</p>
                  <p className="text-[11px] text-muted-foreground">Sent</p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 py-2">
                  <p className="font-bold text-red-600">{sendProgress.failed}</p>
                  <p className="text-[11px] text-muted-foreground">Failed</p>
                </div>
                <div className="rounded-lg bg-muted py-2">
                  <p className="font-bold">{sendProgress.total}</p>
                  <p className="text-[11px] text-muted-foreground">Total</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Batch {sendProgress.done} of {sendProgress.chunks}…
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border/60 p-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Subject</span>
                  <span className="font-medium text-right truncate">{subject}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Recipients</span>
                  <span className="font-medium">{selectedIds.length} clients</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Properties</span>
                  <span className="font-medium">
                    {includeProperty && propertyIds.length
                      ? `${propertyIds.length} selected`
                      : "Not included"}
                  </span>
                </div>
                {!body.trim() && (
                  <p className="text-[11px] text-amber-600">
                    The body is empty — recipients will only see the greeting and property cards.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowConfirm(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={!canSend}
                  onClick={runSend}
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  Send to {selectedIds.length} client{selectedIds.length === 1 ? "" : "s"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Last send result */}
      <Dialog open={!!lastResult} onOpenChange={() => setLastResult(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Campaign Complete</DialogTitle>
            <DialogDescription>Here is how the send went.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-4">
              <p className="text-2xl font-bold text-emerald-600">{lastResult?.sent}</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Sent</p>
            </div>
            <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-4">
              <p className="text-2xl font-bold text-red-600">{lastResult?.failed}</p>
              <p className="text-xs text-red-700 dark:text-red-300">Failed</p>
            </div>
            <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-4">
              <p className="text-2xl font-bold">{lastResult?.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setLastResult(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
