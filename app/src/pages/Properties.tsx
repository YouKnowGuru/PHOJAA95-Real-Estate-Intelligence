import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { trpc } from "@/lib/trpc";
import type { RouterOutputs } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/**
 * Fix Cloudinary f_auto URLs that may serve JXL (JPEG XL) format
 * which is not supported by Safari/iOS. Replace with f_jpg for universal compatibility.
 */
function fixCloudinaryUrl(url: string): string {
  if (!url) return url;
  // Replace f_auto with f_jpg to avoid JXL on Safari
  return url.replace(/\/f_auto(?=\/,)/g, "/f_jpg");
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Search,
  MapPin,
  User,
  Trash2,
  ArrowRight,
  Filter,
  Tag,
  Shield,
  Layers,
  SlidersHorizontal,
  X,
  Mail,
  Calendar,
  CalendarCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { STEP_LABELS } from "@/constants/workflow";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage } from "@/components/ui/animated-page";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  pending_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  completed: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function Properties() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "submitted" | "pending_review" | "approved" | "rejected" | "completed" | "cancelled">("all");
  const [step, setStep] = useState<string>("all");
  const [propertyTypeId, setPropertyTypeId] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [dateType, setDateType] = useState<"createdAt" | "completedAt">("createdAt");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.property.list.useQuery({
    search: debouncedSearch || undefined,
    status: status === "all" ? undefined : status || undefined,
    step: step && step !== "all" ? parseInt(step) : undefined,
    propertyTypeId: propertyTypeId && propertyTypeId !== "all" ? parseInt(propertyTypeId) : undefined,
    dateType: (dateFrom || dateTo) ? dateType : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const { data: propertyTypes } = trpc.propertyType.list.useQuery();

  const deleteMutation = trpc.property.delete.useMutation({
    onSuccess: () => {
      toast.success("Property deleted successfully");
      utils.property.list.invalidate();
      setDeleteId(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setDeleteId(null);
    },
  });

  const handleDelete = (id: number, name: string) => {
    setDeleteId(id);
    setDeleteName(name);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate({ id: deleteId });
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setStep("all");
    setPropertyTypeId("all");
    setDateType("createdAt");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = search !== "" || status !== "all" || step !== "all" || propertyTypeId !== "all" || dateFrom !== "" || dateTo !== "";

  const filterContent = (
    <>
      <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
        <SelectTrigger className="h-9 w-full sm:w-[140px] text-xs">
          <Filter className="mr-1.5 h-3 w-3" />
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="submitted">Submitted</SelectItem>
          <SelectItem value="pending_review">Pending Review</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>
      <Select value={step} onValueChange={(v) => setStep(v)}>
        <SelectTrigger className="h-9 w-full sm:w-[130px] text-xs">
          <Layers className="mr-1.5 h-3 w-3" />
          <SelectValue placeholder="Step" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Steps</SelectItem>
          <SelectItem value="1">Step 1</SelectItem>
          <SelectItem value="2">Step 2</SelectItem>
          <SelectItem value="3">Step 3</SelectItem>
          <SelectItem value="4">Step 4</SelectItem>
          <SelectItem value="5">Step 5</SelectItem>
        </SelectContent>
      </Select>
      <Select value={propertyTypeId} onValueChange={(v) => setPropertyTypeId(v)}>
        <SelectTrigger className="h-9 w-full sm:w-[140px] text-xs">
          <Tag className="mr-1.5 h-3 w-3" />
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {propertyTypes?.map((pt) => (
            <SelectItem key={pt.id} value={pt.id.toString()}>
              {pt.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date range filter */}
      <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
        <Select value={dateType} onValueChange={(v) => setDateType(v as typeof dateType)}>
          <SelectTrigger className="h-9 w-full sm:w-[150px] text-xs">
            <Calendar className="mr-1.5 h-3 w-3" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Created Date</SelectItem>
            <SelectItem value="completedAt">Sold Date</SelectItem>
          </SelectContent>
        </Select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full sm:w-[130px]"
          title="From date"
        />
        <span className="text-xs text-muted-foreground hidden sm:block">–</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full sm:w-[130px]"
          title="To date"
        />
      </div>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-9 text-muted-foreground hover:text-foreground gap-1"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </>
  );

  return (
    <AnimatedPage>
      <PageHeader
        title="Properties"
        description={
          data?.total !== undefined
            ? `Manage and track all ${data.total} ${data.total === 1 ? "property listing" : "property listings"}`
            : "Manage and track all property listings"
        }
        icon={<Building2 className="h-5 w-5" />}
        actions={
          <Link to="/properties/new">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button className="bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 gap-1.5 h-9">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Property</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </motion.div>
          </Link>
        }
      />

      {/* Filters */}
      <div className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name, owner, address or invoice no. (e.g. INV-00012)…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 h-9 bg-background/80"
            />
            {search && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="icon"
            className="h-9 w-9 shrink-0 sm:hidden"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
        <div className={cn("flex flex-wrap items-center gap-2", !showFilters && "hidden sm:flex")}>
          {filterContent}
        </div>
      </div>

      {/* Property Grid */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to load properties"
          description={error.message}
          onRetry={clearFilters}
        />
      ) : data?.items?.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties found"
          description={
            isAdmin
              ? "Your search didn't return any results. Try adjusting your filters or adding a new listing."
              : "You haven't listed any properties yet. Start your journey by adding your first listing."
          }
          action={
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
              <Link to="/properties/new">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add Property
                </Button>
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.items.map((property, index) => (
              <PropertyCard
                key={property.id}
                property={property}
                index={index}
                isAdmin={isAdmin}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
            <AlertDialogContent className="rounded-2xl max-w-[calc(100%-2rem)] sm:max-w-[425px]">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Property</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{deleteName}"? This action cannot be undone and all associated data will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmDelete}
                  disabled={deleteMutation.isPending}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </AnimatedPage>
  );
}

type PropertyItem = RouterOutputs["property"]["list"]["items"][number];

function PropertyCard({ property, index, isAdmin, onDelete }: {
  property: PropertyItem;
  index: number;
  isAdmin: boolean;
  onDelete: (id: number, name: string) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const navigate = useNavigate();
  const isPending = !property.isSold && property.currentStep === 4;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      <Link to={`/properties/${property.id}`}>
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ duration: 0.2 }}
          className="group h-full relative"
        >
          {/* Framer Motion pulsing glow ring — only for unsold/pending properties */}
          {isPending && (
            <motion.div
              className="absolute inset-[-2px] rounded-2xl pointer-events-none"
              animate={{
                boxShadow: [
                  "0 0 0 1.5px rgba(251,191,36,0.55), 0 0 18px 2px rgba(251,191,36,0.18)",
                  "0 0 0 1.5px rgba(52,211,153,0.65), 0 0 24px 4px rgba(52,211,153,0.22)",
                  "0 0 0 1.5px rgba(251,191,36,0.55), 0 0 18px 2px rgba(251,191,36,0.18)",
                ],
              }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <div className="relative h-full rounded-xl border border-border/40 bg-card overflow-hidden shadow-sm transition-shadow duration-300 hover:shadow-md">
            {/* Image — compact 16/9 ratio */}
            <div className="relative aspect-video w-full overflow-hidden bg-muted">
              {property.images && property.images.length > 0 && !imageError ? (
                <img
                  src={fixCloudinaryUrl(property.images[0].url)}
                  alt={property.propertyName}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground/20">
                  <Building2 className="h-8 w-8" />
                </div>
              )}
              <div className="absolute top-2 left-2 z-10">
                <Badge
                  variant="secondary"
                  className={`text-[9px] font-semibold uppercase shadow-sm rounded-full px-1.5 py-0 ${statusColors[property.approvalStatus] || ""}`}
                >
                  {property.approvalStatus?.replace("_", " ")}
                </Badge>
              </div>
              {property.isSold ? (
                <div className="absolute top-2 right-2 z-10">
                  <Badge className="bg-red-600 text-white border-0 shadow-sm rounded-full text-[9px] px-1.5 py-0">
                    SOLD
                  </Badge>
                </div>
              ) : isPending ? (
                <div className="absolute top-2 right-2 z-10">
                  <Badge className="bg-amber-500/90 text-white border-0 shadow-md rounded-full text-[9px] flex items-center gap-1 px-1.5 py-0">
                    <motion.span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-white"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                    />
                    Pending
                  </Badge>
                </div>
              ) : null}
            </div>
            {/* Card Body — compact */}
            <div className="p-3">
              {/* Step pill + type */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex h-5 px-1.5 items-center justify-center rounded-md bg-primary/10">
                  <span className="text-[9px] font-bold text-primary">Step {property.currentStep}</span>
                </div>
                <span className="text-[9px] text-muted-foreground truncate max-w-[60%] text-right">
                  {STEP_LABELS[property.currentStep] || "Unknown"}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-[13px] font-semibold text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-1 leading-tight">
                {property.propertyName}
              </h3>

              {/* Meta row */}
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
                  <Tag className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{property.propertyTypeName || "—"}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{property.address}</span>
                </div>
              </div>

              {/* Owner */}
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-2">
                <User className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{property.ownerName}</span>
                <span className="text-border mx-0.5">·</span>
                <Shield className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{property.ownerCID}</span>
              </div>

              {/* Dates */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Calendar className="h-2.5 w-2.5 shrink-0" />
                  <span>
                    {property.createdAt
                      ? new Date(property.createdAt).toLocaleDateString("en-BT", { year: "numeric", month: "short", day: "numeric" })
                      : "—"}
                  </span>
                </div>
                {property.isSold && property.completedAt && (
                  <div className="flex items-center gap-1 text-[10px] text-red-500 font-semibold">
                    <CalendarCheck className="h-2.5 w-2.5 shrink-0" />
                    <span>
                      Sold {new Date(property.completedAt).toLocaleDateString("en-BT", { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                  </div>
                )}
              </div>

              {/* Price + Commission footer */}
              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <div className="min-w-0">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">
                    {property.propertyTypeName === "Land" && property.finalSellingPrice ? "Final Price" : "Price"}
                  </p>
                  <p className="text-xs font-bold text-foreground truncate">
                    Nu.{" "}
                    {parseFloat(
                      property.propertyTypeName === "Land"
                        ? (property.finalSellingPrice || property.sellingPrice || "0")
                        : (property.sellingPrice || "0")
                    ).toLocaleString("en-BT", { minimumFractionDigits: 2 })}
                  </p>
                  {property.propertyTypeName === "Land" && property.finalSellingPrice && property.finalSellingPrice !== property.sellingPrice && (
                    <p className="text-[9px] text-muted-foreground line-through">
                      Nu. {parseFloat(property.sellingPrice ?? "0").toLocaleString("en-BT", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <div className="text-right min-w-0">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">Comm.</p>
                    <p className="text-xs font-bold text-primary truncate">
                      Nu. {parseFloat(property.realEstateFee ?? "0").toLocaleString("en-BT", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-primary shrink-0"
                    title="Email clients about this property"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/email-campaigns?propertyId=${property.id}`);
                    }}
                  >
                    <Mail className="h-3 w-3" />
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-1 text-muted-foreground hover:text-red-500 shrink-0"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete(property.id, property.propertyName);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

// Note: Uses the imported `cn` from @/lib/utils instead of a local redefinition
