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
import { Card, CardContent } from "@/components/ui/card";
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

  // Real search debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
            {isAdmin ? "Properties" : "My Properties"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
            Manage and track all property listings
          </p>
        </div>
        <Link to="/properties/new" className="self-start sm:self-center">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button className="bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/20 w-full sm:w-auto text-sm h-9 sm:h-10">
              <Plus className="mr-1.5 sm:mr-2 h-3.5 sm:h-4 w-3.5 sm:w-4" />
              <span className="hidden sm:inline">Add Property</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </motion.div>
        </Link>
      </div>

      {/* Filters */}
      <Card className="border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
        <CardContent className="p-3 sm:p-4">
          {/* Mobile Filter Toggle */}
          <div className="flex items-center gap-2 mb-3 sm:mb-0">
            <div className="relative flex-1 min-w-[120px] sm:min-w-[180px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search properties..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 h-9 sm:h-10"
              />
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              className="h-9 sm:hidden"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-1" />
              {hasActiveFilters && (
                <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded text-xs">
                  {[status !== "all", step !== "all", propertyTypeId !== "all"].filter(Boolean).length}
                </span>
              )}
            </Button>
          </div>

          {/* Filter Controls */}
          <div className={`${showFilters ? "block" : "hidden"} sm:block`}>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Select value={status} onValueChange={(v) => { setStatus(v as typeof status); setPage(1); }}>
                <SelectTrigger className="h-9 sm:h-10 w-[130px] sm:w-[150px]">
                  <Filter className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  <SelectValue placeholder="Status" className="text-xs sm:text-sm" />
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
                <SelectTrigger className="h-9 sm:h-10 w-[130px] sm:w-[150px]">
                  <Layers className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  <SelectValue placeholder="Step" className="text-xs sm:text-sm" />
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
                <SelectTrigger className="h-9 sm:h-10 w-[130px] sm:w-[150px]">
                  <Tag className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  <SelectValue placeholder="Type" className="text-xs sm:text-sm" />
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
                  className="h-9 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Clear</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Property Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
                <AlertTriangle className="h-10 w-10 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-red-700 dark:text-red-400">Failed to load properties</h3>
              <p className="text-sm text-red-600 dark:text-red-300 mt-2 max-w-[280px] text-center">{error.message}</p>
              <div className="mt-8 flex gap-3">
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
                <Link to="/properties/new">
                  <Button className="bg-primary text-white hover:bg-primary/90">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Property
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : data?.items?.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="border-border/50 bg-white/50 backdrop-blur-sm dark:bg-slate-800/50">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="h-20 w-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
                <Building2 className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <h3 className="text-xl font-bold text-foreground">No properties found</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-[280px] text-center">
                {isAdmin 
                  ? "Your search didn't return any results. Try adjusting your filters or adding a new listing." 
                  : "You haven't listed any properties yet. Start your journey by adding your first listing."}
              </p>
              <div className="mt-8 flex gap-3">
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
                <Link to="/properties/new">
                  <Button className="bg-primary text-white hover:bg-primary/90">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Property
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3">
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
            <AlertDialogContent>
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
            <Pagination className="mt-4 sm:mt-6">
              <PaginationContent className="flex-wrap justify-center">
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage(Math.max(1, page - 1))}
                    className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer text-xs sm:text-sm"}
                  />
                </PaginationItem>
                {/* Show limited pages on mobile */}
                {data.totalPages <= 7 ? (
                  [...Array(data.totalPages)].map((_, i) => (
                    <PaginationItem key={i + 1}>
                      <PaginationLink
                        isActive={page === i + 1}
                        onClick={() => setPage(i + 1)}
                        className="cursor-pointer text-xs sm:text-sm min-w-[32px] sm:min-w-[40px]"
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
                            <PaginationLink
                              isActive={page === i}
                              onClick={() => setPage(i)}
                              className="cursor-pointer text-xs sm:text-sm min-w-[32px] sm:min-w-[40px]"
                            >
                              {i}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <span className="text-xs sm:text-sm text-muted-foreground">...</span>
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink
                            onClick={() => setPage(data.totalPages)}
                            className="cursor-pointer text-xs sm:text-sm min-w-[32px] sm:min-w-[40px]"
                          >
                            {data.totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      </>
                    ) : page >= data.totalPages - 2 ? (
                      <>
                        <PaginationItem>
                          <PaginationLink
                            onClick={() => setPage(1)}
                            className="cursor-pointer text-xs sm:text-sm min-w-[32px] sm:min-w-[40px]"
                          >
                            1
                          </PaginationLink>
                        </PaginationItem>
                        <PaginationItem>
                          <span className="text-xs sm:text-sm text-muted-foreground">...</span>
                        </PaginationItem>
                        {[data.totalPages - 3, data.totalPages - 2, data.totalPages - 1, data.totalPages].map((i) => (
                          <PaginationItem key={i}>
                            <PaginationLink
                              isActive={page === i}
                              onClick={() => setPage(i)}
                              className="cursor-pointer text-xs sm:text-sm min-w-[32px] sm:min-w-[40px]"
                            >
                              {i}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                      </>
                    ) : (
                      <>
                        <PaginationItem>
                          <PaginationLink
                            onClick={() => setPage(1)}
                            className="cursor-pointer text-xs sm:text-sm min-w-[32px] sm:min-w-[40px]"
                          >
                            1
                          </PaginationLink>
                        </PaginationItem>
                        <PaginationItem>
                          <span className="text-xs sm:text-sm text-muted-foreground">...</span>
                        </PaginationItem>
                        {[page - 1, page, page + 1].map((i) => (
                          <PaginationItem key={i}>
                            <PaginationLink
                              isActive={page === i}
                              onClick={() => setPage(i)}
                              className="cursor-pointer text-xs sm:text-sm min-w-[32px] sm:min-w-[40px]"
                            >
                              {i}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <span className="text-xs sm:text-sm text-muted-foreground">...</span>
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink
                            onClick={() => setPage(data.totalPages)}
                            className="cursor-pointer text-xs sm:text-sm min-w-[32px] sm:min-w-[40px]"
                          >
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
                    className={page >= data.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer text-xs sm:text-sm"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
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
      transition={{ delay: index * 0.05 }}
      className="h-full"
    >
      <Link to={`/properties/${property.id}`}>
        <motion.div
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.99 }}
        >
          <Card className="group border-border/50 bg-white/70 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/50 dark:bg-slate-800/70 dark:hover:border-primary/50 cursor-pointer h-full overflow-hidden rounded-xl sm:rounded-2xl">
            <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
              {property.images && property.images.length > 0 && !imageError ? (
                <img
                  src={property.images[0].url}
                  alt={property.propertyName}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground/20 bg-slate-50 dark:bg-slate-900">
                  <Building2 className="h-8 sm:h-12 w-8 sm:w-12" />
                </div>
              )}
              <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10">
                <Badge
                  variant="secondary"
                  className={`text-[9px] sm:text-[10px] font-semibold uppercase shadow-sm px-1.5 py-0.5 ${statusColors[property.approvalStatus] || ""}`}
                >
                  {property.approvalStatus?.replace("_", " ")}
                </Badge>
              </div>
              {property.isSold && (
                <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10">
                  <Badge className="bg-red-600 text-white border-0 shadow-sm animate-pulse text-[9px] sm:text-[10px]">
                    SOLD
                  </Badge>
                </div>
              )}
            </div>
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="flex h-5 sm:h-6 px-1.5 sm:px-2 items-center justify-center rounded bg-primary/10 dark:bg-primary/20">
                  <span className="text-[9px] sm:text-[10px] font-bold text-primary dark:text-primary-foreground">
                    Step {property.currentStep}
                  </span>
                </div>
                <Badge variant="outline" className="text-[9px] sm:text-[10px] hidden xs:block">
                  {STEP_LABELS[property.currentStep] || "Unknown"}
                </Badge>
              </div>

              <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-1">
                {property.propertyName}
              </h3>

              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2 sm:mb-3">
                <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                <span className="truncate">{property.propertyTypeName || "Unknown"}</span>
              </div>

              <div className="space-y-1 sm:space-y-2 mb-3 sm:mb-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-2.5 sm:h-3 w-2.5 sm:w-3 shrink-0" />
                  <span className="truncate">{property.address}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="h-2.5 sm:h-3 w-2.5 sm:w-3 shrink-0" />
                  <span className="truncate">{property.ownerName}</span>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3 shrink-0" />
                  <span>CID: {property.ownerCID}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-border/50">
                <div className="flex flex-col min-w-0">
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider font-bold truncate">Price</p>
                  <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                    {parseFloat(property.sellingPrice ?? "0").toLocaleString()}
                  </p>
                </div>
                <div className="text-right flex flex-col items-end min-w-0">
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider font-bold truncate">Comm.</p>
                  <p className="text-sm sm:text-base font-bold text-primary dark:text-primary-foreground truncate">
                    {parseFloat(property.realEstateFee ?? "0").toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-2 sm:mt-3 flex items-center justify-between">
                <span className="xs:hidden text-[9px] text-muted-foreground">
                  {STEP_LABELS[property.currentStep] || "Unknown"}
                </span>
                <div className="flex items-center gap-1 sm:gap-2 ml-auto">
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 sm:h-7 w-6 sm:w-7 text-muted-foreground hover:text-red-500"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete(property.id, property.propertyName);
                      }}
                    >
                      <Trash2 className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                    </Button>
                  )}
                  <ArrowRight className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </Link>
    </motion.div>
  );
}
