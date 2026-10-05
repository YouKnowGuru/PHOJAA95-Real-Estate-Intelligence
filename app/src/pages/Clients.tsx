import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  Users as UsersIcon,
  Upload,
  Mail,
  Phone,
  UserCircle,
  Contact,
} from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage } from "@/components/ui/animated-page";
import { AppleCard, AppleCardContent } from "@/components/ui/apple-card";
import { KPICard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { StatusBadge } from "@/components/ui/status-badge";
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

type ClientRow = {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  groupName: string;
  notes: string | null;
  status: "active" | "unsubscribed";
  createdAt: Date;
};

const emptyForm = { fullName: "", email: "", phone: "", groupName: "General", notes: "" };

function parseCsv(text: string): Array<{
  fullName: string;
  email: string;
  phone: string;
  groupName: string;
}> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const split = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  let start = 0;
  const first = split(lines[0]).map((c) => c.toLowerCase());
  const looksLikeHeader = first.some((c) => c.includes("email")) && !first.some((c) => c.includes("@"));
  if (looksLikeHeader) start = 1;

  const rows: Array<{ fullName: string; email: string; phone: string; groupName: string }> = [];
  for (let i = start; i < lines.length; i++) {
    const cells = split(lines[i]);
    // Layouts: Name,Email | Name,Email,Phone | Name,Email,Phone,Group | Email,Name,...
    const emailIdx = cells.findIndex((c) => c.includes("@"));
    if (emailIdx === -1) continue;
    const email = cells[emailIdx];
    const nameIdx = cells.findIndex((c, idx) => idx !== emailIdx && c && !c.includes("@") && !/^\+?\d[\d\s-]{5,}$/.test(c));
    const phoneIdx = cells.findIndex((c) => /^\+?\d[\d\s-]{5,}$/.test(c));
    const groupIdx = cells.findIndex(
      (c, idx) => idx !== emailIdx && idx !== nameIdx && idx !== phoneIdx && c,
    );
    rows.push({
      fullName: nameIdx >= 0 ? cells[nameIdx] : email.split("@")[0],
      email,
      phone: phoneIdx >= 0 ? cells[phoneIdx] : "",
      groupName: groupIdx >= 0 ? cells[groupIdx] : "",
    });
  }
  return rows;
}

export default function Clients() {
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [csvText, setCsvText] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = trpc.clients.list.useQuery({
    search: debouncedSearch || undefined,
    group: groupFilter !== "all" ? groupFilter : undefined,
    status: statusFilter !== "all" ? (statusFilter as "active" | "unsubscribed") : undefined,
  });

  const { data: groups } = trpc.clients.groups.useQuery();

  const rows = (data?.rows ?? []) as ClientRow[];
  const total = data?.total ?? 0;

  const activeCount = useMemo(
    () => rows.filter((r) => r.status === "active").length,
    [rows],
  );
  const unsubscribedCount = rows.length - activeCount;

  const invalidate = () => {
    utils.clients.list.invalidate();
    utils.clients.groups.invalidate();
  };

  const createMutation = trpc.clients.create.useMutation({
    onSuccess: () => {
      toast.success("Client added");
      invalidate();
      setShowAdd(false);
      setForm(emptyForm);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.clients.update.useMutation({
    onSuccess: () => {
      toast.success("Client updated");
      invalidate();
      setEditing(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const setStatusMutation = trpc.clients.setStatus.useMutation({
    onSuccess: (_res, vars) => {
      toast.success(vars.status === "active" ? "Client reactivated" : "Client unsubscribed");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.clients.delete.useMutation({
    onSuccess: () => {
      toast.success("Client deleted");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const importMutation = trpc.clients.importCsv.useMutation({
    onSuccess: (res) => {
      toast.success(`Imported ${res.imported} client${res.imported === 1 ? "" : "s"}`, {
        description: res.skipped ? `${res.skipped} skipped (already exist)` : undefined,
      });
      invalidate();
      setShowImport(false);
      setCsvText("");
    },
    onError: (err) => toast.error(err.message),
  });

  const parsedRows = useMemo(() => parseCsv(csvText), [csvText]);
  const hasActiveFilters = Boolean(debouncedSearch || groupFilter !== "all" || statusFilter !== "all");

  const openEdit = (c: ClientRow) => {
    setEditing(c);
    setForm({
      fullName: c.fullName,
      email: c.email,
      phone: c.phone ?? "",
      groupName: c.groupName ?? "General",
      notes: c.notes ?? "",
    });
  };

  return (
    <AnimatedPage>
      <PageHeader
        title="Clients"
        description="Manage your mailing list — the recipients of property email campaigns"
        icon={<Contact className="h-5 w-5" />}
        actions={
          <>
            <Button variant="outline" onClick={() => setShowImport(true)} className="gap-1.5">
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button
              onClick={() => {
                setForm(emptyForm);
                setShowAdd(true);
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add Client
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Total Clients" value={total} icon={UsersIcon} color="bg-primary" delay={0} />
        <KPICard title="Active" value={activeCount} icon={Mail} color="bg-emerald-500" delay={0.1} />
        <KPICard
          title="Unsubscribed"
          value={unsubscribedCount}
          icon={UserCircle}
          color="bg-amber-500"
          delay={0.2}
        />
        <KPICard
          title="Groups"
          value={groups?.length ?? 0}
          icon={Contact}
          color="bg-violet-500"
          delay={0.3}
        />
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, email, phone..."
        hasActiveFilters={hasActiveFilters}
        onClearFilters={() => {
          setSearch("");
          setGroupFilter("all");
          setStatusFilter("all");
        }}
        filters={
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-full sm:w-44 h-10">
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 h-10">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No clients found"
          description={
            hasActiveFilters
              ? "Try adjusting your search or filters."
              : "Add your first client or import a CSV to build your mailing list."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((client, index) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.3) }}
            >
              <AppleCard hover>
                <AppleCardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                        {client.fullName.charAt(0).toUpperCase() || "@"}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold truncate">{client.fullName}</h3>
                        <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                      </div>
                    </div>
                    <StatusBadge variant={client.status === "active" ? "success" : "warning"}>
                      {client.status === "active" ? "Active" : "Unsubscribed"}
                    </StatusBadge>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    {client.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3" />
                        {client.phone}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <UsersIcon className="h-3 w-3" />
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {client.groupName}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        setStatusMutation.mutate({
                          id: client.id,
                          status: client.status === "active" ? "unsubscribed" : "active",
                        })
                      }
                      disabled={setStatusMutation.isPending}
                    >
                      {client.status === "active" ? "Unsubscribe" : "Reactivate"}
                    </Button>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(client)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(`Delete client "${client.fullName}"?`)) {
                            deleteMutation.mutate({ id: client.id });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </AppleCardContent>
              </AppleCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog
        open={showAdd || !!editing}
        onOpenChange={(open) => {
          if (!open) {
            setShowAdd(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Client" : "Add Client"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update this contact's details." : "Add a contact to your mailing list."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editing) updateMutation.mutate({ id: editing.id, ...form });
              else createMutation.mutate(form);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Group</Label>
                <Input
                  value={form.groupName}
                  onChange={(e) => setForm({ ...form, groupName: e.target.value })}
                  placeholder="General"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAdd(false);
                  setEditing(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editing
                    ? "Save Changes"
                    : "Add Client"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* CSV import dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="rounded-2xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Import Clients from CSV</DialogTitle>
            <DialogDescription>
              Paste CSV rows as <code>Name,Email,Phone,Group</code>. A header row is optional and
              duplicates are skipped automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={8}
              placeholder={"Name,Email,Phone,Group\nPema Wangmo,pema@example.com,171234567,Buyers\nTshering Dorji,tshering@example.com,,Investors"}
              className="font-mono text-xs"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {parsedRows.length} valid row{parsedRows.length === 1 ? "" : "s"} detected
                {parsedRows.length ? " — existing emails are skipped automatically" : ""}
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowImport(false)}>
                Cancel
              </Button>
              <Button
                disabled={!parsedRows.length || importMutation.isPending}
                onClick={() => importMutation.mutate({ rows: parsedRows.slice(0, 2000) })}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {importMutation.isPending ? "Importing..." : `Import ${parsedRows.length} rows`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
