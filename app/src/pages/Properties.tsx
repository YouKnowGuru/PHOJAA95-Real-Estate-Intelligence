import { useState, useEffect } from "react";
import { Link } from "react-router";
import { trpc } from "@/lib/trpc";
import type { RouterOutputs } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
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
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
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
  AlertTriangle,
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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "submitted" | "pending_review" | "approved" | "rejected" | "completed" | "cancelled">("all");
  const [step, setStep] = useState<string>("all");
  const [propertyTypeId, setPropertyTypeId] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

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
    page,
    limit: 12,
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
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setStep("all");
    setPropertyTypeId("all");
    setPage(1);
  };

  const hasActiveFilters = search !== "" || status !== "all" || step !== "all" || propertyTypeId !== "all";

  const filterContent = (
    <>
      <Select value={status} onValueChange={(v) => { setStatus(v as typeof status); setPage(1); }}>
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
      <Select value={step} onValueChange={(v) => { setStep(v); setPage(1); }}>
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
      <Select value={propertyTypeId} onValueChange={(v) => { setPropertyTypeId(v); setPage(1); }}>
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
        title={isAdmin ? "Properties" : "My Properties"}
        description="Manage and track all property listings"
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
              placeholder="Search properties..."
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <Pagination className="mt-6">
              <PaginationContent className="flex-wrap justify-center gap-y-2">
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage(Math.max(1, page - 1))}
                    className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {data.totalPages <= 7 ? (
                  [...Array(data.totalPages)].map((_, i) => (
                    <PaginationItem key={i + 1}>
                      <PaginationLink
                        isActive={page === i + 1}
                        onClick={() => setPage(i + 1)}
                        className="cursor-pointer"
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))
                ) : (
                  <>
                    {page <= 3 ? (
                      <>
                        {[1, 2, 3, 4].map((i) => (
                          <PaginationItem key={i}>
                            <PaginationLink isActive={page === i} onClick={() => setPage(i)} className="cursor-pointer">
                              {i}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <span className="text-sm text-muted-foreground px-2">...</span>
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink onClick={() => setPage(data.totalPages)} className="cursor-pointer">
                            {data.totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      </>
                    ) : page >= data.totalPages - 2 ? (
                      <>
                        <PaginationItem>
                          <PaginationLink onClick={() => setPage(1)} className="cursor-pointer">1</PaginationLink>
                        </PaginationItem>
                        <PaginationItem>
                          <span className="text-sm text-muted-foreground px-2">...</span>
                        </PaginationItem>
                        {[data.totalPages - 3, data.totalPages - 2, data.totalPages - 1, data.totalPages].map((i) => (
                          <PaginationItem key={i}>
                            <PaginationLink isActive={page === i} onClick={() => setPage(i)} className="cursor-pointer">
                              {i}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                      </>
                    ) : (
                      <>
                        <PaginationItem>
                          <PaginationLink onClick={() => setPage(1)} className="cursor-pointer">1</PaginationLink>
                        </PaginationItem>
                        <PaginationItem>
                          <span className="text-sm text-muted-foreground px-2">...</span>
                        </PaginationItem>
                        {[page - 1, page, page + 1].map((i) => (
                          <PaginationItem key={i}>
                            <PaginationLink isActive={page === i} onClick={() => setPage(i)} className="cursor-pointer">
                              {i}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <span className="text-sm text-muted-foreground px-2">...</span>
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink onClick={() => setPage(data.totalPages)} className="cursor-pointer">
                            {data.totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      </>
                    )}
                  </>
                )}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage(Math.min(data.totalPages, page + 1))}
                    className={page >= data.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
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
          className="group h-full"
        >
          <div className="h-full rounded-2xl border border-border/40 bg-card overflow-hidden shadow-apple transition-shadow duration-300 hover:shadow-apple-lg">
            <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full overflow-hidden bg-muted">
              {property.images && property.images.length > 0 && !imageError ? (
                <img
                  src={property.images[0].url}
                  alt={property.propertyName}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground/20">
                  <Building2 className="h-10 w-10" />
                </div>
              )}
              <div className="absolute top-3 left-3 z-10">
                <Badge
                  variant="secondary"
                  className={`text-[10px] font-semibold uppercase shadow-sm rounded-full px-2 py-0.5 ${statusColors[property.approvalStatus] || ""}`}
                >
                  {property.approvalStatus?.replace("_", " ")}
                </Badge>
              </div>
              {property.isSold && (
                <div className="absolute top-3 right-3 z-10">
                  <Badge className="bg-red-600 text-white border-0 shadow-sm rounded-full text-[10px]">
                    SOLD
                  </Badge>
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-6 px-2 items-center justify-center rounded-lg bg-primary/10">
                  <span className="text-[10px] font-bold text-primary">
                    Step {property.currentStep}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] rounded-full hidden xs:inline-flex">
                  {STEP_LABELS[property.currentStep] || "Unknown"}
                </Badge>
              </div>

              <h3 className="text-sm font-semibold text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-1">
                {property.propertyName}
              </h3>

              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                <Tag className="h-3 w-3 shrink-0" />
                <span className="truncate">{property.propertyTypeName || "Unknown"}</span>
              </div>

              <div className="space-y-1.5 mb-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{property.address}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate">{property.ownerName}</span>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3 shrink-0" />
                  <span>CID: {property.ownerCID}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/30">
                <div className="flex flex-col min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold truncate">
                    {property.propertyTypeName === "Land" && property.finalSellingPrice ? "Final Price" : "Price"}
                  </p>
                  <p className="text-sm font-bold text-foreground truncate">
                    Nu. {parseFloat(property.propertyTypeName === "Land" ? (property.finalSellingPrice || property.sellingPrice || "0") : (property.sellingPrice || "0")).toLocaleString("en-BT", { minimumFractionDigits: 2 })}
                  </p>
                  {property.propertyTypeName === "Land" && property.finalSellingPrice && property.finalSellingPrice !== property.sellingPrice && (
                    <p className="text-[10px] text-muted-foreground line-through">
                      Nu. {parseFloat(property.sellingPrice ?? "0").toLocaleString("en-BT", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
                <div className="text-right flex flex-col items-end min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold truncate">Comm.</p>
                  <p className="text-sm font-bold text-primary truncate">
                    Nu. {parseFloat(property.realEstateFee ?? "0").toLocaleString("en-BT", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="xs:hidden text-[10px] text-muted-foreground">
                  {STEP_LABELS[property.currentStep] || "Unknown"}
                </span>
                <div className="flex items-center gap-1.5 ml-auto">
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-red-500"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete(property.id, property.propertyName);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}
