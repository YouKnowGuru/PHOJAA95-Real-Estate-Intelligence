import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Building2,
  MapPin,
  User,
  Phone,
  FileText,
  Image,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Edit3,
  Shield,
  Clock,
  AlertTriangle,
  Layers,
  ChevronRight,
  MessageSquare,
  Download,
  FileArchive,
  ClipboardList,
  Save,
} from "lucide-react";
import { motion } from "framer-motion";
import { WORKFLOW_STEPS } from "@/constants/workflow";

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  draft: { color: "text-slate-600", bg: "bg-slate-100", icon: FileText },
  submitted: { color: "text-blue-600", bg: "bg-blue-100", icon: FileText },
  pending_review: { color: "text-amber-600", bg: "bg-amber-100", icon: Clock },
  approved: { color: "text-emerald-600", bg: "bg-emerald-100", icon: CheckCircle2 },
  rejected: { color: "text-red-600", bg: "bg-red-100", icon: XCircle },
  completed: { color: "text-violet-600", bg: "bg-violet-100", icon: CheckCircle2 },
};

const steps = WORKFLOW_STEPS.map((step) => ({
  id: step.id,
  label: step.label,
  description: step.description,
}));

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const propertyId = parseInt(id || "0");
  const { isAdmin } = useAuth();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.property.getFullWorkflow.useQuery({ id: propertyId });
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [comments, setComments] = useState("");
  const [mainImageError, setMainImageError] = useState(false);
  const [thumbError, setThumbError] = useState<Record<number, boolean>>({});
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const notesInitialized = useRef(false);

  useEffect(() => {
    if (data?.property?.adminNotes !== undefined && !notesInitialized.current) {
      notesInitialized.current = true;
      setAdminNotes(data.property.adminNotes ?? "");
    }
  }, [data?.property?.adminNotes]);

  const { data: allDocs } = trpc.property.getAllDocuments.useQuery({ propertyId }, { enabled: !!data });
  const { data: siteSettings } = trpc.settings.getPublicSettings.useQuery();

  const validateUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch { return false; }
  };

  const triggerDownload = (url: string, filename: string) => {
    if (!validateUrl(url)) {
      toast.error("Invalid download URL");
      return;
    }
    const safeFilename = filename.replace(/[<>:\"/\\|?*\x00-\x1f]/g, "_");

    // If it's a Cloudinary URL, we can force download by adding fl_attachment
    let downloadUrl = url;
    if (url.includes("cloudinary.com")) {
      if (url.includes("/upload/")) {
        downloadUrl = url.replace("/upload/", "/upload/fl_attachment/");
      }
    }

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", safeFilename);
    link.setAttribute("target", "_blank");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    if (!allDocs || allDocs.length === 0) {
      toast.error("No documents available for download");
      return;
    }
    setShowDownloadDialog(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const approveMutation = trpc.property.approveStep.useMutation({
    onSuccess: () => {
      toast.success("Step approved successfully");
      utils.property.getFullWorkflow.invalidate({ id: propertyId });
      utils.property.list.invalidate();
      utils.property.dashboardStats.invalidate();
      utils.property.staffDashboardStats.invalidate();
      setShowApproveDialog(false);
      setComments("");
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = trpc.property.rejectStep.useMutation({
    onSuccess: () => {
      toast.success("Step rejected with comments");
      utils.property.getFullWorkflow.invalidate({ id: propertyId });
      utils.property.list.invalidate();
      utils.property.dashboardStats.invalidate();
      utils.property.staffDashboardStats.invalidate();
      setShowRejectDialog(false);
      setComments("");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateNotesMutation = trpc.property.update.useMutation({
    onSuccess: () => {
      toast.success("Admin notes updated");
      setIsEditingNotes(false);
      utils.property.getFullWorkflow.invalidate({ id: propertyId });
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Property not found</p>
        <Link to="/properties" className="mt-4">
          <Button variant="outline">Back to Properties</Button>
        </Link>
      </div>
    );
  }

  const { property, agreement, documents, verification, finalLagthram, history } = data;
  const config = statusConfig[property.approvalStatus] || statusConfig.draft;
  const StatusIcon = config.icon;

  const canApprove = isAdmin && (property.approvalStatus === "pending_review" || property.approvalStatus === "submitted");
  const canEdit = !isAdmin && property.approvalStatus !== "completed" && property.approvalStatus !== "approved";

  // Staff and admin can proceed to next step if current step is approved and not yet completed
  const canProceedToNextStep = property.approvalStatus === "approved" && property.currentStep <= 5 && property.workflowStatus !== "completed";

  // For staff - currentStep already points to the step they need to work on after admin approval
  // No need to add +1 since currentStep is already updated by admin approval
  const getNextStep = () => {
    // If approvalStatus is "approved", admin has approved the current step
    // currentStep already points to the next step to work on
    if (property.approvalStatus === "approved" && property.currentStep <= 5) {
      return property.currentStep;
    }
    // If approvalStatus is "submitted" or "pending_review", they can't proceed yet
    if (property.approvalStatus === "submitted" || property.approvalStatus === "pending_review") {
      return null;
    }
    // For draft or rejected, they can continue from current step
    if (property.approvalStatus === "draft" || property.approvalStatus === "rejected") {
      return property.currentStep;
    }
    return null;
  };
  const nextStep = getNextStep();


  return (
    <div className="space-y-6">
      {/* Back & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link to="/properties">
            <Button variant="outline" size="icon" className="rounded-lg">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {property.propertyName}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge className={`${config.bg} ${config.color} border-0`}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {property.approvalStatus?.replace("_", " ")}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                Step {property.currentStep} of 5
              </Badge>
              {property.isSold && (
                <Badge className="bg-red-600 text-white border-0 shadow-sm animate-pulse">
                  SOLD
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Workflow Progress Bar */}
        <div className="hidden lg:flex flex-col gap-2 min-w-[200px]">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-muted-foreground">Workflow Progress</span>
            <span className="text-primary">{Math.round((property.currentStep / 5) * 100)}%</span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(property.currentStep / 5) * 100}%` }}
              className="h-full bg-gradient-to-r from-primary to-primary/80"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {property.approvalStatus === "completed" && (
            <Button
              variant="outline"
              className="rounded-lg border-primary/20 text-primary bg-primary/5 hover:bg-primary/10"
              onClick={handleDownloadAll}
            >
              <Download className="mr-2 h-4 w-4" />
              Download All Docs
            </Button>
          )}
          {canProceedToNextStep && nextStep && (
            <Link to={`/properties/${propertyId}/wizard?step=${nextStep}`}>
              <Button className="rounded-lg bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/20">
                <ChevronRight className="mr-2 h-4 w-4" />
                Continue to Step {nextStep}
              </Button>
            </Link>
          )}
          {canEdit && !canProceedToNextStep && (
            <Link to={`/properties/${propertyId}/wizard?step=${property.currentStep}`}>
              <Button variant="outline" className="rounded-lg">
                <Edit3 className="mr-2 h-4 w-4" />
                Continue Workflow
              </Button>
            </Link>
          )}
          {canApprove && (
            <>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="outline"
                  className="rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setShowRejectDialog(true)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  className="rounded-lg bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/20"
                  onClick={() => setShowApproveDialog(true)}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </motion.div>
            </>
          )}
        </div>
      </div>

      {/* Property Images Gallery */}
      {data.images && data.images.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="md:col-span-2 lg:col-span-2 xl:col-span-3 aspect-[16/9] relative rounded-2xl overflow-hidden shadow-sm border border-border/50 group bg-slate-100 dark:bg-slate-900">
            {data.images && data.images.length > 0 && !mainImageError ? (
              <img
                src={data.images[0].url}
                alt={property.propertyName}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 cursor-pointer"
                onClick={() => setSelectedImage(data.images[0].url)}
                onError={() => setMainImageError(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground/20 bg-slate-100 dark:bg-slate-900">
                <Building2 className="h-16 w-16" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute bottom-4 left-4 z-10 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-500 translate-y-2 group-hover:translate-y-0">
              <h2 className="text-xl font-bold">{property.propertyName}</h2>
              <p className="text-sm text-white/80 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {property.address}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:h-full">
            {data.images.slice(1, 5).map((img, idx) => (
              <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-border/50 bg-slate-50 dark:bg-slate-900 group">
                {!thumbError[idx] ? (
                  <img
                    src={img.url}
                    alt={`Property ${idx + 1}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 cursor-pointer"
                    onClick={() => setSelectedImage(img.url)}
                    onError={() => setThumbError(prev => ({ ...prev, [idx]: true }))}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground/20 bg-slate-50 dark:bg-slate-900">
                    <Building2 className="h-8 w-8" />
                  </div>
                )}
              </div>
            ))}
            {data.images.length > 5 && (
              <div
                className="aspect-square rounded-xl overflow-hidden border border-border/50 bg-slate-100 dark:bg-slate-900 flex items-center justify-center relative group cursor-pointer"
                onClick={() => setSelectedImage(data.images[5].url)}
              >
                <img
                  src={data.images[5].url}
                  className="w-full h-full object-cover opacity-40 blur-sm"
                  alt="More images"
                />
                <span className="absolute text-lg font-bold text-slate-700 dark:text-slate-200 z-10">
                  +{data.images.length - 5} More
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completion Celebration / Certificate */}
      {property.approvalStatus === "completed" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative mb-12 print-only-ancestor"
        >
          {/* Bhutanese glow backdrop */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-yellow-400/10 to-red-700/20 blur-3xl rounded-full print:hidden" />

          {/* Fail-safe A4 Print - Maximum Compatibility Version */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: A4;
                margin: 0;
              }

              /* Hide everything outside the certificate */
              body * {
                visibility: hidden !important;
              }

              /* Show the certificate wrapper and all its children */
              .print-only-ancestor,
              .print-only-ancestor *,
              .certificate-print-area,
              .certificate-print-area * {
                visibility: visible !important;
              }

              /* The ancestor wrapper must not add any space */
              .print-only-ancestor {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                z-index: 2147483647 !important;
              }

              /* The certificate itself fills the A4 page */
              .certificate-print-area {
                position: relative !important;
                left: 0 !important;
                top: 0 !important;
                width: 210mm !important;
                height: 297mm !important;
                min-height: 297mm !important;
                max-height: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #FFFDF5 !important;
                display: flex !important;
                flex-direction: column !important;
                border: 3px solid #DAA520 !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                overflow: visible !important;
                box-sizing: border-box !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              /* Fix for internal layout containers */
              .certificate-print-area div { display: block !important; }
              .certificate-print-area .flex { display: flex !important; }
              .certificate-print-area .grid { display: grid !important; }
              
              /* Force ALL border variants to render for corner decorations */
              .certificate-print-area .border,
              .certificate-print-area .border-2,
              .certificate-print-area .border-t-2,
              .certificate-print-area .border-b-2,
              .certificate-print-area .border-l-2,
              .certificate-print-area .border-r-2,
              .certificate-print-area [class*="border-t-"],
              .certificate-print-area [class*="border-b-"],
              .certificate-print-area [class*="border-l-"],
              .certificate-print-area [class*="border-r-"] {
                border-style: solid !important;
                border-color: #DAA520 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              /* Force border-y variants on the property name highlight */
              .certificate-print-area .border-y-2 {
                border-top-style: solid !important;
                border-bottom-style: solid !important;
                border-color: #DAA520 !important;
              }
              
              /* Render horizontal rule lines */
              .certificate-print-area .h-px {
                background-color: #8B4513 !important;
                height: 1px !important;
                display: block !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              /* Force gradient backgrounds/stripes to render in print */
              .certificate-print-area .h-4,
              .certificate-print-area .h-2,
              .certificate-print-area .h-1 {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              /* The top/bottom saffron and crimson stripes */
              .certificate-print-area > .shrink-0 {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              /* Ensure absolute corner decorations are visible */
              .certificate-print-area .absolute {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              /* Force background colors on party detail cards */
              .certificate-print-area .rounded-xl {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              /* Hide the screen-only glow and print button */
              .blur-3xl { display: none !important; }
              .print\\:hidden { display: none !important; }
            }
          `}} />

          <div className="flex justify-end mb-4 print:hidden">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/80 dark:bg-slate-800/80 border-primary/20 hover:bg-primary/5 text-primary gap-2"
              onClick={handlePrint}
            >
              <Download className="h-4 w-4" />
              Download Certificate (PDF)
            </Button>
          </div>

          <div className="certificate-print-area relative overflow-hidden print:overflow-visible rounded-2xl shadow-2xl print:shadow-none print:rounded-none bg-[#FFFDF5] flex flex-col mx-auto" style={{ maxWidth: '210mm' }}>
            {/* Top saffron stripe - Bhutanese flag top half */}
            <div className="h-4 bg-gradient-to-r from-[#FF8000] via-[#FFA500] to-[#FF8000] shrink-0" />
            {/* Bottom crimson stripe - Bhutanese flag bottom half */}
            <div className="h-2 bg-gradient-to-r from-[#8B0000] via-[#DC143C] to-[#8B0000] shrink-0" />

            <div className="p-6 md:p-10 text-center relative flex-1 flex flex-col justify-between">
              {/* Corner Decorations - High Contrast for Print */}
              <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-orange-400 print:border-orange-600 rounded-tl-lg" />
              <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-orange-400 print:border-orange-600 rounded-tr-lg" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-orange-400 print:border-orange-600 rounded-bl-lg" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-orange-400 print:border-orange-600 rounded-br-lg" />

              {/* Decorative top border */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#FFD700] to-transparent" />

              {/* Header - Logo + Site Name */}
              <div className="flex flex-col items-center gap-2 mb-3">
                <div className="relative">
                  {siteSettings?.site_logo ? (
                    <img
                      src={siteSettings.site_logo}
                      alt={siteSettings.site_name || "PHOJAA95"}
                      className="h-16 w-16 rounded-full object-cover border-4 border-[#FFD700] shadow-lg shadow-orange-200"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#FF8000] to-[#DC143C] flex items-center justify-center border-4 border-[#FFD700] shadow-lg shadow-orange-200">
                      <Building2 className="h-8 w-8 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-lg font-bold tracking-[0.25em] text-[#8B4513] uppercase">{siteSettings?.site_name || "PHOJAA95"}</p>
                  <p className="text-[9px] text-[#DC143C] tracking-[0.3em] uppercase font-semibold">Real Estate · Druk Yul · Bhutan</p>
                </div>

                {/* Gold divider */}
                <div className="flex items-center gap-2 w-full max-w-xs">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#FFD700]" />
                  <span className="text-[#FFD700] text-[8px]">◆</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#FFD700]" />
                </div>
              </div>

              {/* Certificate Title */}
              <div className="space-y-1 mb-4">
                <p className="text-[10px] font-bold tracking-[0.5em] uppercase text-[#DC143C]">— Official Document —</p>
                <h2 className="text-4xl md:text-5xl font-serif font-black text-[#4A1A00] uppercase tracking-[0.08em]">
                  Certificate
                </h2>
                <p className="text-base font-semibold tracking-[0.4em] text-[#8B4513] uppercase">of Completion</p>
              </div>

              {/* Body text */}
              <div className="space-y-2 max-w-xl mx-auto mb-3 italic font-serif text-base text-[#3D1A00]">
                <p>This is to officially certify the successful completion of the property transaction for</p>
                <div className="py-3 px-8 border-y-2 border-[#FFD700] bg-gradient-to-r from-transparent via-[#FFF3DC] to-transparent">
                  <p className="text-2xl font-black not-italic text-[#8B0000] tracking-wide">{property.propertyName}</p>
                  <p className="text-xs text-[#8B4513] mt-0.5 not-italic flex items-center justify-center gap-2">
                    <MapPin className="h-3 w-3" /> {property.address}
                  </p>
                </div>
              </div>

              {/* Party details - Balanced Centered */}
              <div className="grid grid-cols-2 gap-4 mb-4 max-w-xl mx-auto text-center">
                <div className="p-3 rounded-xl border border-[#FFD700]/50 bg-gradient-to-br from-orange-50 to-yellow-50 flex flex-col items-center">
                  <p className="text-[8px] font-black text-[#DC143C] uppercase tracking-[0.2em] mb-1">Seller (Owner)</p>
                  <p className="text-sm font-bold text-[#3D1A00] leading-tight">{property.ownerName}</p>
                  <p className="text-[10px] text-[#8B4513]">CID: {property.ownerCID}</p>
                  {property.ownerPhone && <p className="text-[10px] text-[#8B4513]">Ph: {property.ownerPhone}</p>}
                </div>
                <div className="p-3 rounded-xl border border-[#DC143C]/30 bg-gradient-to-br from-red-50 to-orange-50 flex flex-col items-center">
                  <p className="text-[8px] font-black text-[#DC143C] uppercase tracking-[0.2em] mb-1">Buyer</p>
                  <p className="text-sm font-bold text-[#3D1A00] leading-tight">{property.buyerName || "N/A"}</p>
                  <p className="text-[10px] text-[#8B4513]">CID: {property.buyerCID || "N/A"}</p>
                  {property.buyerPhone && <p className="text-[10px] text-[#8B4513]">Ph: {property.buyerPhone}</p>}
                </div>
              </div>

              {/* Date */}
              <div className="inline-flex flex-col items-center gap-0.5 mb-4 px-10 py-2 rounded-full border border-[#FFD700]/60 bg-[#FFF3DC]/50 mx-auto">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#8B4513]">Concluded On</p>
                <p className="text-base font-bold text-[#4A1A00]">
                  {property.completedAt ? new Date(property.completedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : new Date().toLocaleDateString()}
                </p>
              </div>

              {/* Signature line - More space for physical stamps/signatures */}
              <div className="grid grid-cols-2 gap-4 sm:gap-8 md:gap-16 max-w-lg mx-auto mb-6">
                <div className="text-center space-y-2">
                  <div className="h-24" /> {/* Space for physical stamp */}
                  <div className="h-px bg-gradient-to-r from-transparent via-[#8B4513] to-transparent" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#4A1A00]">Administrative Seal</p>
                </div>
                <div className="text-center space-y-2">
                  <div className="h-24" /> {/* Space for physical signature */}
                  <div className="h-px bg-gradient-to-r from-transparent via-[#8B4513] to-transparent" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#4A1A00]">Authorized Signature</p>
                </div>
              </div>

              <p className="text-[8px] text-[#8B4513]/50 tracking-widest uppercase mt-1">
                PROP-{property.id}-{new Date().getFullYear()} • {siteSettings?.site_name || "PHOJAA95"} Real Estate Management System
              </p>

              {/* Decorative bottom border */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#FFD700] to-transparent" />
            </div>

            {/* Bottom crimson + saffron stripe */}
            <div className="h-2 bg-gradient-to-r from-[#8B0000] via-[#DC143C] to-[#8B0000] shrink-0" />
            <div className="h-4 bg-gradient-to-r from-[#FF8000] via-[#FFA500] to-[#FF8000] shrink-0" />
          </div>
        </motion.div>
      )}

      {/* Workflow Steps */}
      <Card className="border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70 overflow-hidden">
        <CardContent className="p-6">
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute left-4 top-8 bottom-8 w-0.5 bg-slate-200 dark:bg-slate-700" />

            <div className="space-y-4">
              {steps.map((step, index) => {
                const isCompleted = step.id < property.currentStep || property.approvalStatus === "completed";
                const isCurrent = step.id === property.currentStep;
                const stepHistory = history?.filter((h) => h.step === step.id);
                const lastAction = stepHistory?.[stepHistory.length - 1];

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`relative flex items-start gap-4 p-4 rounded-xl transition-all ${isCurrent
                        ? "bg-primary/5 border border-primary/20 dark:bg-primary/10 dark:border-primary/30"
                        : isCompleted
                          ? "bg-slate-50/30 dark:bg-slate-800/30"
                          : "opacity-50"
                      }`}
                  >
                    {/* Step Indicator */}
                    <div
                      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isCompleted
                          ? "bg-primary text-white shadow-sm shadow-primary/20"
                          : isCurrent
                            ? "bg-primary/10 text-primary border-2 border-primary/50 dark:bg-primary/20 dark:text-primary-foreground"
                            : "bg-slate-200 text-slate-500 dark:bg-slate-700"
                        }`}
                    >
                      {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : step.id}
                    </div>

                    {/* Step Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-sm font-semibold ${isCurrent ? "text-primary dark:text-primary-foreground" : "text-foreground"}`}>
                          {step.label}
                        </h4>
                        {lastAction && (
                          <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                            {lastAction.action}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>

                      {/* Step-specific content */}
                      {isCurrent && (
                        <div className="mt-3 space-y-2">
                          {step.id === 1 && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <span className="text-muted-foreground">Type: {property.propertyTypeName}</span>
                              <span className="text-muted-foreground">Price: Nu. {parseFloat(property.sellingPrice ?? "0").toLocaleString()}</span>
                            </div>
                          )}
                          {step.id === 2 && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <span className="text-muted-foreground font-medium">Buyer: {property.buyerName || "N/A"}</span>
                              <span className="text-muted-foreground">CID: {property.buyerCID || "N/A"}</span>
                            </div>
                          )}
                          {step.id === 2 && agreement && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <span className="text-muted-foreground">Agreement: {agreement.agreementFile ? "Uploaded" : "Pending"}</span>
                              <span className="text-muted-foreground">Payment: {agreement.paymentScreenshot ? "Uploaded" : "Pending"}</span>
                            </div>
                          )}
                          {step.id === 3 && documents && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <span className="text-muted-foreground">Gewog Cert: {documents.gewogCertification ? "Uploaded" : "Pending"}</span>
                              <span className="text-muted-foreground">Occupancy: {documents.occupancyCertificate ? "Uploaded" : "Pending"}</span>
                            </div>
                          )}
                          {step.id === 4 && verification && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <span className="text-muted-foreground">Lagthram: {verification.lagthramStatus}</span>
                              <span className="text-muted-foreground">Loan: {verification.loanStatus}</span>
                            </div>
                          )}
                          {step.id === 5 && finalLagthram && (
                            <div className="text-xs text-muted-foreground">
                              Final document: {finalLagthram.finalDocument ? "Uploaded" : "Pending"}
                            </div>
                          )}
                        </div>
                      )}

                      {lastAction?.comments && (
                        <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                          <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>{lastAction.comments}</span>
                        </div>
                      )}

                      {/* Explicit Continue button inside the step card for Staff */}
                      {isCurrent && canProceedToNextStep && nextStep === step.id && (
                        <div className="mt-4">
                          <Link to={`/properties/${propertyId}/wizard?step=${step.id}`}>
                            <Button size="sm" className="h-8 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] shadow-sm shadow-primary/20">
                              Start {step.label}
                              <ChevronRight className="ml-1 h-3 w-3" />
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Property Details - Step 1: Property Info */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Step 1: Property Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailItem icon={Building2} label="Property Type" value={property.propertyTypeName || "N/A"} color="text-primary" />
            <DetailItem icon={MapPin} label="Address" value={property.address} color="text-primary" />
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Selling Price</p>
                <p className="text-sm font-bold">Nu. {parseFloat(property.sellingPrice ?? "0").toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Comm. (3%)</p>
                <p className="text-sm font-bold text-primary dark:text-primary-foreground">Nu. {parseFloat(property.realEstateFee ?? "0").toLocaleString()}</p>
              </div>
            </div>
            {!!property.features && typeof property.features === 'object' && Object.keys(property.features as object).length > 0 && (
              <div className="pt-4">
                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Property Features</h4>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(property.features as Record<string, unknown>).map(([key, value], idx) => (
                    <DetailItem key={idx} icon={Building2} label={key} value={String(value)} color="text-primary" />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-blue-500" />
              Owner Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailItem icon={User} label="Owner Name" value={property.ownerName} color="text-blue-500" />
            <DetailItem icon={Shield} label="CID Number" value={property.ownerCID} color="text-blue-500" />
            <div className="grid grid-cols-2 gap-4 pt-2">
              <DetailItem icon={Phone} label="Phone" value={property.ownerPhone} color="text-blue-500" />
              <DetailItem icon={MapPin} label="Owner Address" value={property.ownerAddress} color="text-blue-500" />
            </div>
            {property.noObjectionLetter && (
              <div className="pt-2">
                <a
                  href={property.noObjectionLetter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  <FileText className="h-4 w-4" />
                  View No Objection Letter
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-emerald-500" />
              Buyer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailItem icon={User} label="Buyer Name" value={property.buyerName || "N/A"} color="text-emerald-500" />
            <DetailItem icon={Shield} label="CID Number" value={property.buyerCID || "N/A"} color="text-emerald-500" />
            <div className="grid grid-cols-2 gap-4 pt-2">
              <DetailItem icon={Phone} label="Phone" value={property.buyerPhone || "N/A"} color="text-emerald-500" />
              <DetailItem icon={MapPin} label="Buyer Address" value={property.buyerAddress || "N/A"} color="text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Step 2: Agreement & Payment */}
      {property.currentStep >= 2 && (
        <Card className="border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-500" />
              Step 2: Agreement & Initial Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agreement ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <p className="text-xs text-muted-foreground">Agreement File</p>
                    {agreement.agreementFile ? (
                      <a
                        href={agreement.agreementFile}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-emerald-600 hover:underline flex items-center gap-1"
                      >
                        <FileText className="h-4 w-4" /> View File
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-amber-600">Pending</p>
                    )}
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <p className="text-xs text-muted-foreground">Initial Payment (50%)</p>
                    {agreement.paymentScreenshot ? (
                      <a
                        href={agreement.paymentScreenshot}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-emerald-600 hover:underline flex items-center gap-1"
                      >
                        <Image className="h-4 w-4" /> View Image
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-amber-600">Pending</p>
                    )}
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <p className="text-xs text-muted-foreground">Commission Amount</p>
                    <p className="text-sm font-medium">Nu. {parseFloat(agreement.commissionAmount || "0").toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className={`text-sm font-medium ${agreement.approvalStatus === "approved" ? "text-emerald-600" :
                        agreement.approvalStatus === "rejected" ? "text-red-600" : "text-amber-600"
                      }`}>
                      {agreement.approvalStatus}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No agreement data submitted yet</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Property Documents */}
      {property.currentStep >= 3 && (
        <Card className="border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-purple-500" />
              Step 3: Property Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {documents ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-xs text-muted-foreground">Gewog Endorse Document</p>
                  {documents.gewogCertification ? (
                    <a href={documents.gewogCertification} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-emerald-600 hover:underline flex items-center gap-1">
                      <FileText className="h-4 w-4" /> View
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-amber-600">Pending</p>
                  )}
                </div>

                {property.requiresBuildingDocs && (
                  <>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                      <p className="text-xs text-muted-foreground">Internal Agreement</p>
                      {documents.internalAgreement ? (
                        <a href={documents.internalAgreement} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-emerald-600 hover:underline flex items-center gap-1">
                          <FileText className="h-4 w-4" /> View
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-amber-600">Pending</p>
                      )}
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                      <p className="text-xs text-muted-foreground">Occupancy Certificate</p>
                      {documents.occupancyCertificate ? (
                        <a href={documents.occupancyCertificate} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-emerald-600 hover:underline flex items-center gap-1">
                          <FileText className="h-4 w-4" /> View
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-amber-600">Pending</p>
                      )}
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                      <p className="text-xs text-muted-foreground">PLR Verification</p>
                      {documents.plrVerification ? (
                        <a href={documents.plrVerification} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-emerald-600 hover:underline flex items-center gap-1">
                          <FileText className="h-4 w-4" /> View
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-amber-600">Pending</p>
                      )}
                    </div>
                  </>
                )}

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-xs text-muted-foreground">Remaining Payment</p>
                  {documents.remainingPaymentScreenshot ? (
                    <a href={documents.remainingPaymentScreenshot} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-emerald-600 hover:underline flex items-center gap-1">
                      <Image className="h-4 w-4" /> View
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-amber-600">Pending</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No documents submitted yet</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Verification Process */}
      {property.currentStep >= 4 && (
        <Card className="border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-cyan-500" />
              Step 4: Verification Process
            </CardTitle>
          </CardHeader>
          <CardContent>
            {verification ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-xs text-muted-foreground">Lagthram Status</p>
                  <p className={`text-sm font-medium ${verification.lagthramStatus === "completed" ? "text-primary" :
                      verification.lagthramStatus === "processing" ? "text-blue-600" : "text-amber-600"
                    }`}>
                    {verification.lagthramStatus}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-xs text-muted-foreground">Lagthram Completed</p>
                  <p className="text-sm font-medium">
                    {verification.lagthramCompletedAt ? new Date(verification.lagthramCompletedAt).toLocaleDateString() : "Not completed"}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-xs text-muted-foreground">Loan Status</p>
                  <p className={`text-sm font-medium ${verification.loanStatus === "completed" ? "text-primary" :
                      verification.loanStatus === "processing" ? "text-blue-600" : "text-amber-600"
                    }`}>
                    {verification.loanStatus}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-xs text-muted-foreground">Loan Completed</p>
                  <p className="text-sm font-medium">
                    {verification.loanCompletedAt ? new Date(verification.loanCompletedAt).toLocaleDateString() : "Not completed"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Verification not started yet</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 5: Final Completion */}
      {property.currentStep >= 5 && (
        <Card className="border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Step 5: Final Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            {finalLagthram ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-xs text-muted-foreground">Final Lagthram</p>
                  {finalLagthram.finalDocument ? (
                    <a href={finalLagthram.finalDocument} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-emerald-600 hover:underline flex items-center gap-1">
                      <FileText className="h-4 w-4" /> View
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-amber-600">Pending</p>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-xs text-muted-foreground">Completion Certificate</p>
                  {finalLagthram.completionCertificate ? (
                    <a href={finalLagthram.completionCertificate} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-emerald-600 hover:underline flex items-center gap-1">
                      <FileText className="h-4 w-4" /> View
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-amber-600">Pending</p>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className={`text-sm font-medium ${finalLagthram.approvalStatus === "approved" ? "text-primary" :
                      finalLagthram.approvalStatus === "rejected" ? "text-red-600" : "text-amber-600"
                    }`}>
                    {finalLagthram.approvalStatus}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Final documents not submitted yet</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Approval History */}
      <Card className="border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Approval History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history && history.length > 0 ? (
            <>
              {(showAllHistory ? history : history.slice(0, 3)).map((h, i) => (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ x: 4, backgroundColor: "rgba(var(--primary-rgb), 0.05)" }}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/30 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-default"
                >
                  <div className={`mt-0.5 h-2 w-2 rounded-full mt-2 ${h.action === "approved" ? "bg-primary" : h.action === "rejected" ? "bg-red-500" : "bg-blue-500"
                    }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground capitalize">{h.action}</span>
                      <Badge variant="outline" className="text-[10px]">Step {h.step}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {h.createdAt ? new Date(h.createdAt).toLocaleDateString() : ""}
                      </span>
                    </div>
                    {h.comments && (
                      <p className="mt-1 text-xs text-muted-foreground">{h.comments}</p>
                    )}
                  </div>
                </motion.div>
              ))}

              {history.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground hover:text-primary"
                  onClick={() => setShowAllHistory(!showAllHistory)}
                >
                  {showAllHistory ? "Show Less" : `View All (${history.length})`}
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No history yet</p>
          )}
        </CardContent>
      </Card>

      {/* Admin Notes */}
      {isAdmin && (
        <Card className="border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70 border-primary/20 shadow-sm shadow-primary/5">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Internal Admin Notes
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (isEditingNotes) {
                  updateNotesMutation.mutate({ id: propertyId, adminNotes });
                } else {
                  setIsEditingNotes(true);
                }
              }}
              disabled={updateNotesMutation.isPending}
            >
              {isEditingNotes ? (
                <><Save className="h-4 w-4 mr-2" /> Save</>
              ) : (
                <><Edit3 className="h-4 w-4 mr-2" /> Edit</>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            {isEditingNotes ? (
              <div className="space-y-3">
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add private notes about this property..."
                  className="min-h-[100px]"
                />
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => {
                    setIsEditingNotes(false);
                    setAdminNotes(property.adminNotes || "");
                  }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm text-muted-foreground whitespace-pre-wrap min-h-[60px]">
                {property.adminNotes || "No internal notes."}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Approve Step {property.currentStep}
            </DialogTitle>
            <DialogDescription>
              You are about to approve {steps[property.currentStep - 1]?.label} for &quot;{property.propertyName}&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Comments (optional)</label>
              <Textarea
                placeholder="Add any notes or comments..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/20"
              onClick={() => approveMutation.mutate({ propertyId, step: property.currentStep, comments })}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? "Approving..." : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Reject Step {property.currentStep}
            </DialogTitle>
            <DialogDescription>
              Rejection requires a comment explaining the reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Rejection Reason *</label>
              <Textarea
                placeholder="Explain why this step is being rejected..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!comments.trim()) {
                  toast.error("Comments are required for rejection");
                  return;
                }
                rejectMutation.mutate({ propertyId, step: property.currentStep, comments });
              }}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Download All Dialog */}
      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileArchive className="h-5 w-5 text-emerald-500" />
              Property Documents Archive
            </DialogTitle>
            <DialogDescription>
              Access all legal and payment documents for &quot;{property.propertyName}&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid gap-3 sm:grid-cols-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {allDocs?.map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300 group shadow-sm hover:shadow-md hover:border-primary/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm group-hover:bg-primary/5 transition-colors">
                      <FileText className="h-5 w-5 text-slate-500 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{doc.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{doc.type}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
                    onClick={() => triggerDownload(doc.url, doc.name)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100/50 dark:border-amber-900/20 flex gap-3 items-start">
              <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-400">
                <p className="font-bold mb-1 uppercase tracking-wider">Popup Blocker Warning</p>
                <p>Multiple file downloads may be blocked by your browser. Please allow popups for this site or download files individually if needed.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDownloadDialog(false)}>
              Close
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/20"
              onClick={() => {
                allDocs?.forEach((doc, i) => {
                  setTimeout(() => triggerDownload(doc.url, doc.name), i * 800);
                });
                toast.success("Attempting batch download...");
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-transparent overflow-hidden shadow-none">
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={selectedImage || ""}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              alt="Property preview"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 text-white hover:bg-white/20 rounded-full"
              onClick={() => setSelectedImage(null)}
            >
              <XCircle className="h-6 w-6" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 ${color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

