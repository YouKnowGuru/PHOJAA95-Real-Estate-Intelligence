import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { FileUploader } from "@/components/FileUploader";
import { DOCUMENT_UPLOAD_ACCEPT } from "@contracts/upload";
import { GoogleMapPicker } from "@/components/GoogleMapPicker";
import { CloudinaryUpload } from "@/components/CloudinaryUpload";
import {
  Building2,
  ChevronRight,
  ChevronLeft,
  Send,
  FileText,
  Upload,
  CheckCircle2,
  Shield,
  AlertTriangle,
  Plus,
  Trash2,
  ExternalLink,
  Calculator,
  Tag,
  Ruler,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { WORKFLOW_STEPS } from "@/constants/workflow";

const steps = WORKFLOW_STEPS.map(({ id, label }) => ({
  id,
  label,
  icon: [Building2, FileText, Upload, Shield, CheckCircle2][id - 1]!,
}));

const BUILDING_DOC_TYPES = ["Building", "Flat", "Apartment", "Duplex", "Bungalow"];

type DocSlot = "agreementFile" | "gewogCertification" | "internalAgreement" | "occupancyCertificate" | "plrVerification";

const DOC_SLOT_LABEL: Record<DocSlot, string> = {
  agreementFile: "Property Agreement",
  gewogCertification: "Gewog Endorse Document",
  internalAgreement: "Internal Agreement",
  occupancyCertificate: "Occupancy Certificate",
  plrVerification: "PLR Verification",
};

/** Guess which document slot a selected file belongs to from its file name. */
function inferDocSlot(fileName: string, slots: DocSlot[]): DocSlot | "" {
  const name = fileName.toLowerCase();
  const rules: [DocSlot, RegExp][] = [
    ["internalAgreement", /internal/],
    ["occupancyCertificate", /occupancy|completion|certificate/],
    ["plrVerification", /plr|verification|verify/],
    ["gewogCertification", /gewog|endorse/],
    ["agreementFile", /agreement|contract|deed|sale|purchase|transfer|khazon/],
  ];
  for (const [slot, re] of rules) {
    if (re.test(name) && slots.includes(slot)) return slot;
  }
  return "";
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function PropertyWizard() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { isAdmin } = useAuth();
  const propertyId = id && !Number.isNaN(parseInt(id)) ? parseInt(id) : undefined;
  const step = parseInt(searchParams.get("step") || "1");
  const [currentStep, setCurrentStep] = useState(
    Number.isNaN(step) ? 1 : Math.max(1, Math.min(5, step))
  );

  const { data: propertyTypes } = trpc.propertyType.list.useQuery();
  const { data: existingProperty } = trpc.property.getFullWorkflow.useQuery(
    { id: propertyId! },
    { enabled: !!propertyId }
  );

  const utils = trpc.useUtils();

  // Step 1: Property Info
  const [step1Data, setStep1Data] = useState({
    propertyName: "",
    propertyTypeId: "",
    address: "",
    latitude: "",
    longitude: "",
    ownerName: "",
    ownerCID: "",
    ownerPhone: "",
    ownerAddress: "",
    sellingPrice: "",
    realEstateFee: "",
    loanAmount: "",
    pricePerDecimal: "",
    landSizeDecimal: "",
    finalSellingPrice: "",
    priceOverrideReason: "",
    thramNumber: "",
    plotNumber: "",
    yearOfConstruction: "",
    noObjectionLetter: "",
    images: [] as { url: string; publicId?: string }[],
    features: {} as Record<string, string>,
  });

  const [isPriceOverride, setIsPriceOverride] = useState(false);

  // Determine if selected property type is Land
  const selectedPropertyType = propertyTypes?.find(pt => pt.id === parseInt(step1Data.propertyTypeId));
  const isLandType = selectedPropertyType?.name === "Land";
  const isEditingLand = existingProperty?.property?.propertyTypeName === "Land";

  // Step 2: Buyer & Agreement
  const [step2Data, setStep2Data] = useState({
    buyerName: "",
    buyerCID: "",
    buyerPhone: "",
    buyerAddress: "",
    commissionAmount: "",
    totalAmountPaid: "",
  });

  // Step 3: Documents (the property agreement is uploaded here with everything else)
  const [step3Data, setStep3Data] = useState({
    agreementFile: "",
    gewogCertification: "",
    internalAgreement: "",
    occupancyCertificate: "",
    plrVerification: "",
  });

  // Bulk upload: files chosen at once, then attached to their slots in Step 3
  const [bulkFiles, setBulkFiles] = useState<{ key: string; file: File; fileName: string; slot: DocSlot | "" }[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  // Step 4: Verification
  const [step4Data, setStep4Data] = useState({
    lagthramStatus: "pending" as "pending" | "processing" | "completed",
    loanStatus: "pending" as "pending" | "processing" | "completed",
  });

  // Step 5: Final
  const [step5Data, setStep5Data] = useState({
    finalDocument: "",
    completionCertificate: "",
  });

  const hasHydrated = useRef(false);

  // Load existing data for all steps
  useEffect(() => {
    if (!existingProperty || hasHydrated.current) return;
    hasHydrated.current = true;
    
    const p = existingProperty.property;
    if (p) {

      setStep1Data({
        propertyName: p.propertyName || "",
        propertyTypeId: p.propertyTypeId?.toString() || "",
        address: p.address || "",
        latitude: p.latitude?.toString() || "",
        longitude: p.longitude?.toString() || "",
        ownerName: p.ownerName || "",
        ownerCID: p.ownerCID || "",
        ownerPhone: p.ownerPhone || "",
        ownerAddress: p.ownerAddress || "",
        sellingPrice: p.sellingPrice?.toString() || "",
        realEstateFee: p.realEstateFee?.toString() || "",
        loanAmount: p.loanAmount?.toString() || "",
        pricePerDecimal: p.pricePerDecimal?.toString() || "",
        landSizeDecimal: p.landSizeDecimal?.toString() || "",
        finalSellingPrice: p.finalSellingPrice?.toString() || "",
        priceOverrideReason: p.priceOverrideReason || "",
        thramNumber: p.thramNumber || "",
        plotNumber: p.plotNumber || "",
        yearOfConstruction: p.yearOfConstruction?.toString() || "",
        noObjectionLetter: p.noObjectionLetter || "",
        images: existingProperty.images?.map(img => ({
          url: img.url,
          publicId: img.publicId ?? undefined
        })) || [],
        features: (() => {
          if (!p.features) return {};
          if (typeof p.features === "string") {
            try {
              const parsed = JSON.parse(p.features);
              // Handle double-encoded JSON
              if (typeof parsed === "string") {
                try {
                  const doubleParsed = JSON.parse(parsed);
                  return typeof doubleParsed === "object" && doubleParsed !== null && !Array.isArray(doubleParsed) ? doubleParsed : {};
                } catch {
                  return {};
                }
              }
              return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
            } catch {
              return {};
            }
          }
          if (typeof p.features === "object" && !Array.isArray(p.features)) {
            return p.features as Record<string, string>;
          }
          return {};
        })(),
      });
    }

    // Load Step 2 data
    if (existingProperty.agreement || p) {
      const price = parseFloat(p.finalSellingPrice ?? p.sellingPrice ?? "0") || 0;
      const stepNo = p.currentStep ?? 0;
      const storedTotal = existingProperty.agreement?.totalAmountPaid?.toString();

      // Legacy records (50% advance + remaining split) are converted to the same
      // total the billing screens calculate, so nothing about past data changes
      const legacyPayment = existingProperty.agreement?.paymentAmount;
      const legacyRemaining = existingProperty.documents?.remainingPaymentAmount;
      let legacyTotal = "";
      if (legacyPayment != null || legacyRemaining != null) {
        const initial = legacyPayment != null ? parseFloat(legacyPayment) : price / 2;
        const remaining = legacyRemaining != null ? parseFloat(legacyRemaining) : Math.max(0, price - initial);
        legacyTotal = ((stepNo >= 3 ? initial : 0) + (stepNo >= 4 ? remaining : 0)).toFixed(2);
      }

      setStep2Data(prev => ({
        ...prev,
        buyerName: p.buyerName || prev.buyerName || "",
        buyerCID: p.buyerCID || prev.buyerCID || "",
        buyerPhone: p.buyerPhone || prev.buyerPhone || "",
        buyerAddress: p.buyerAddress || prev.buyerAddress || "",
        commissionAmount: existingProperty.agreement?.commissionAmount?.toString() || p?.realEstateFee?.toString() || prev.commissionAmount || "",
        totalAmountPaid: storedTotal || legacyTotal || prev.totalAmountPaid || "",
      }));
    }

    // Load Step 3 data (documents + the agreement file, which is uploaded here)
    if (existingProperty.documents || existingProperty.agreement) {
      setStep3Data(prev => ({
        ...prev,
        agreementFile: existingProperty.agreement?.agreementFile || prev.agreementFile || "",
        gewogCertification: existingProperty.documents?.gewogCertification || prev.gewogCertification || "",
        internalAgreement: existingProperty.documents?.internalAgreement || prev.internalAgreement || "",
        occupancyCertificate: existingProperty.documents?.occupancyCertificate || prev.occupancyCertificate || "",
        plrVerification: existingProperty.documents?.plrVerification || prev.plrVerification || "",
      }));
    }

    // Load Step 4 data
    if (existingProperty.verification) {
      setStep4Data({
        lagthramStatus: existingProperty.verification.lagthramStatus || "pending",
        loanStatus: existingProperty.verification.loanStatus || "pending",
      });
    }

    // Load Step 5 data
    if (existingProperty.finalLagthram) {
      setStep5Data({
        finalDocument: existingProperty.finalLagthram.finalDocument || "",
        completionCertificate: existingProperty.finalLagthram.completionCertificate || "",
      });
    }
  }, [existingProperty]);

  // Sync currentStep with actual property state when data loads
  useEffect(() => {
    if (!existingProperty?.property) return;
    
    const actualStep = existingProperty.property.currentStep;
    const isRejected = existingProperty.property.approvalStatus === "rejected";
    const stepParam = searchParams.get("step");
    const urlStep = stepParam ? parseInt(stepParam, 10) : 1;
    
    // If URL step is ahead of actual step and not rejected, clamp to actual step
    if (!isAdmin && urlStep > actualStep && !(isRejected && existingProperty.property.currentStep === urlStep)) {
      setCurrentStep(actualStep);
      const basePath = propertyId ? `/properties/${propertyId}/wizard` : "/properties/new";
      navigate(`${basePath}?step=${actualStep}`, { replace: true });
    }
    // Fix: Use stepParam string instead of searchParams object to prevent infinite re-renders
  }, [existingProperty, navigate, propertyId, searchParams.get("step")]);

  const createMutation = trpc.property.create.useMutation({
    onSuccess: (data) => {
      toast.success("Property created and Step 1 completed!");
      navigate(`/properties/${data.id}/wizard?step=2`);
    },
    onError: (err) => toast.error(err.message),
  });

  const submitStep2Mutation = trpc.property.submitStep2.useMutation({
    onSuccess: () => {
      toast.success("Step 2 saved successfully!");
      utils.property.getFullWorkflow.invalidate({ id: propertyId });
      utils.property.list.invalidate();
      navigate(`/properties/${propertyId}/wizard?step=3`);
    },
    onError: (err) => toast.error(err.message),
  });

  const submitStep3Mutation = trpc.property.submitStep3.useMutation({
    onSuccess: () => {
      toast.success("Step 3 documents saved successfully!");
      utils.property.getFullWorkflow.invalidate({ id: propertyId });
      utils.property.list.invalidate();
      navigate(`/properties/${propertyId}/wizard?step=4`);
    },
    onError: (err) => toast.error(err.message),
  });

  const submitStep4Mutation = trpc.property.submitStep4.useMutation({
    onSuccess: () => {
      const isBothCompleted = step4Data.lagthramStatus === "completed" && step4Data.loanStatus === "completed";
      if (isBothCompleted) {
        toast.success("Verification completed!");
        utils.property.getFullWorkflow.invalidate({ id: propertyId });
        utils.property.list.invalidate();
        navigate(`/properties/${propertyId}/wizard?step=5`);
      } else {
        toast.success("Progress updated successfully");
        utils.property.getFullWorkflow.invalidate({ id: propertyId });
        navigate(`/properties/${propertyId}/wizard?step=4`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const submitStep5Mutation = trpc.property.submitStep5.useMutation({
    onSuccess: () => {
      toast.success(isAdmin ? "Property completed and finalized!" : "Step 5 submitted for admin approval!");
      utils.property.getFullWorkflow.invalidate({ id: propertyId });
      utils.property.list.invalidate();
      navigate(`/properties/${propertyId}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.property.update.useMutation({
    onSuccess: () => {
      toast.success("Property updated successfully");
      utils.property.getFullWorkflow.invalidate({ id: propertyId });
      utils.property.list.invalidate();
      navigate(`/properties/${propertyId}`);
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Step 3 bulk upload ─────────────────────────────────────────────
  const uploadMutation = trpc.upload.upload.useMutation();

  // Document slots offered on this property (building documents only for building types)
  const docTypeName =
    existingProperty?.property?.propertyTypeName ||
    propertyTypes?.find((pt) => pt.id === parseInt(step1Data.propertyTypeId))?.name ||
    "";
  const visibleDocSlots: DocSlot[] = [
    "agreementFile",
    "gewogCertification",
    ...(BUILDING_DOC_TYPES.includes(docTypeName)
      ? (["internalAgreement", "occupancyCertificate", "plrVerification"] as DocSlot[])
      : []),
  ];

  const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setBulkFiles(
      files.map((file, index) => ({
        key: `${Date.now()}-${index}`,
        file,
        fileName: file.name,
        slot: inferDocSlot(file.name, visibleDocSlots),
      }))
    );
  };

  const handleBulkAttach = async () => {
    if (bulkUploading) return;
    const queued = bulkFiles.filter((item) => item.slot !== "");
    if (queued.length === 0) return;

    setBulkUploading(true);
    setBulkProgress({ done: 0, total: queued.length });

    const updates: Partial<typeof step3Data> = {};
    const failed: string[] = [];

    for (let i = 0; i < queued.length; i++) {
      const item = queued[i];
      try {
        if (item.file.size > 10 * 1024 * 1024) {
          throw new Error("File size exceeds 10MB limit");
        }
        const base64 = await readFileAsBase64(item.file);
        const result = await uploadMutation.mutateAsync({
          file: base64,
          fileName: item.file.name,
          mimeType: item.file.type || "application/octet-stream",
          folder: "documents",
          propertyId,
        });
        updates[item.slot as DocSlot] = result.url;
      } catch {
        failed.push(item.fileName);
      }
      setBulkProgress({ done: i + 1, total: queued.length });
    }

    if (Object.keys(updates).length > 0) {
      setStep3Data((prev) => ({ ...prev, ...updates }));
    }
    setBulkFiles((prev) => prev.filter((item) => !item.slot || failed.includes(item.fileName)));
    setBulkUploading(false);
    setBulkProgress(null);

    if (failed.length > 0) {
      toast.error(`Could not upload: ${failed.join(", ")}`);
    } else if (Object.keys(updates).length > 0) {
      toast.success(`${Object.keys(updates).length} document(s) attached below`);
    }
  };

  // ── Land Pricing Auto-Calculation ─────────────────────────────────
  const calculatePricing = () => {
    const pricePerDec = parseFloat(step1Data.pricePerDecimal || "0");
    const landSize = parseFloat(step1Data.landSizeDecimal || "0");

    let sellingPrice = 0;
    if (pricePerDec > 0 && landSize > 0) {
      sellingPrice = pricePerDec * landSize;
    } else if (step1Data.sellingPrice) {
      sellingPrice = parseFloat(step1Data.sellingPrice);
    }

    const finalPrice = Math.max(0, sellingPrice);
    const commission = finalPrice * 0.03;

    return {
      sellingPrice: sellingPrice.toFixed(2),
      finalSellingPrice: finalPrice.toFixed(2),
      realEstateFee: commission.toFixed(2),
    };
  };

  const buildStep1Payload = () => {
    const pricing = calculatePricing();
    const isLand = isLandType || isEditingLand;

    // Clean features: only include valid key-value pairs
    const cleanedFeatures: Record<string, string> = {};
    Object.entries(step1Data.features || {}).forEach(([k, v]) => {
      if (k && k.trim() !== "" && k !== "undefined" && k !== "null") {
        cleanedFeatures[k] = String(v ?? "");
      }
    });
    const hasFeatures = Object.keys(cleanedFeatures).length > 0;

    const payload: Record<string, unknown> = {
      propertyName: step1Data.propertyName,
      propertyTypeId: parseInt(step1Data.propertyTypeId) || 0,
      address: step1Data.address,
      latitude: step1Data.latitude || undefined,
      longitude: step1Data.longitude || undefined,
      ownerName: step1Data.ownerName,
      ownerCID: step1Data.ownerCID,
      ownerPhone: step1Data.ownerPhone,
      ownerAddress: step1Data.ownerAddress,
      sellingPrice: isPriceOverride ? step1Data.sellingPrice : (isLand ? pricing.sellingPrice : step1Data.sellingPrice),
      realEstateFee: isLand ? pricing.realEstateFee : (parseFloat(step1Data.sellingPrice || "0") * 0.03).toFixed(2),
      loanAmount: step1Data.loanAmount || undefined,
      pricePerDecimal: isLand ? step1Data.pricePerDecimal : undefined,
      landSizeDecimal: step1Data.landSizeDecimal,
      finalSellingPrice: isLand ? pricing.finalSellingPrice : undefined,
      priceOverrideReason: isPriceOverride ? step1Data.priceOverrideReason : undefined,
      thramNumber: step1Data.thramNumber || undefined,
      plotNumber: step1Data.plotNumber || undefined,
      yearOfConstruction: step1Data.yearOfConstruction || undefined,
      noObjectionLetter: step1Data.noObjectionLetter || undefined,
      images: step1Data.images,
    };

    // Only include features if:
    // - Creating a new property (propertyId is undefined) and features exist
    // - Updating and features have actual content (preserve existing features if empty)
    if (hasFeatures) {
      payload.features = cleanedFeatures;
    }

    return payload;
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();

    // If editing existing property (propertyId exists), use update instead of create
    if (propertyId) {
      updateMutation.mutate({ id: propertyId, ...buildStep1Payload() });
      return;
    }

    createMutation.mutate(buildStep1Payload() as any);
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    if (!step2Data.buyerName.trim()) {
      toast.error("Please enter the Buyer Name before submitting.");
      return;
    }
    if (!step2Data.buyerCID || step2Data.buyerCID.length !== 11) {
      toast.error("Please enter a valid 11-digit Buyer CID before submitting.");
      return;
    }
    if (!step2Data.buyerPhone.trim()) {
      toast.error("Please enter the Buyer Phone before submitting.");
      return;
    }
    if (!step2Data.buyerAddress.trim()) {
      toast.error("Please enter the Buyer Address before submitting.");
      return;
    }
    if (!step2Data.totalAmountPaid || step2Data.totalAmountPaid.trim() === "") {
      toast.error("Please enter the Total Amount Paid before submitting.");
      return;
    }
    submitStep2Mutation.mutate({
      propertyId,
      ...step2Data,
      commissionAmount: step2Data.commissionAmount || undefined,
      totalAmountPaid: step2Data.totalAmountPaid || undefined,
    });
  };

  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    if (!step3Data.agreementFile) {
      toast.error("Please upload the Property Agreement File before submitting.");
      return;
    }
    if (!step3Data.gewogCertification) {
      toast.error("Please upload the Gewog Endorse Document before submitting.");
      return;
    }
    submitStep3Mutation.mutate({
      propertyId,
      ...step3Data,
    });
  };

  const handleStep4Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    submitStep4Mutation.mutate({
      propertyId,
      ...step4Data,
    });
  };

  const handleStep5Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    if (!step5Data.finalDocument) {
      toast.error("Please upload the Final Lagthram Document before submitting.");
      return;
    }
    submitStep5Mutation.mutate({
      propertyId,
      ...step5Data,
    });
  };

  const navigateToStep = (step: number) => {
    setCurrentStep(step);
    const basePath = propertyId ? `/properties/${propertyId}/wizard` : "/properties/new";
    navigate(`${basePath}?step=${step}`, { replace: true });
  };

  const rejectionReason = existingProperty?.property?.rejectionComments;

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <form onSubmit={handleStep1Submit} className="space-y-5">
            {rejectionReason && existingProperty?.property?.approvalStatus === "rejected" && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">Step Rejected by Admin</p>
                  <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">{rejectionReason}</p>
                </div>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Property Name *</Label>
                <Input
                  value={step1Data.propertyName}
                  onChange={(e) => setStep1Data({ ...step1Data, propertyName: e.target.value })}
                  placeholder="Enter property name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Property Type *</Label>
                <Select
                  value={step1Data.propertyTypeId}
                  onValueChange={(v) => setStep1Data({ ...step1Data, propertyTypeId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyTypes?.map((pt) => (
                      <SelectItem key={pt.id} value={pt.id.toString()}>
                        {pt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span>Year of Construction</span>
                  <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Input
                  type="number"
                  min="1900"
                  max={new Date().getFullYear()}
                  value={step1Data.yearOfConstruction}
                  onChange={(e) => setStep1Data({ ...step1Data, yearOfConstruction: e.target.value })}
                  placeholder="e.g. 2015"
                />
              </div>
              {/* ── LAND PRICING SECTION (Only for Land type) ───────────── */}
              {(isLandType || isEditingLand) && (
                <>
                  <div className="space-y-2">
                    <Label>Price Per Decimal (Nu.) *</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={step1Data.pricePerDecimal}
                      onChange={(e) => {
                        const val = e.target.value;
                        const pricing = calculatePricing();
                        setStep1Data({
                          ...step1Data,
                          pricePerDecimal: val,
                          sellingPrice: isPriceOverride ? step1Data.sellingPrice : pricing.sellingPrice,
                          realEstateFee: pricing.realEstateFee,
                          finalSellingPrice: pricing.finalSellingPrice,
                        });
                      }}
                      placeholder="e.g. 875000"
                      required={!isPriceOverride}
                      disabled={isPriceOverride}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Land Size (Decimal) *</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={step1Data.landSizeDecimal}
                      onChange={(e) => {
                        const val = e.target.value;
                        const pricing = calculatePricing();
                        setStep1Data({
                          ...step1Data,
                          landSizeDecimal: val,
                          sellingPrice: isPriceOverride ? step1Data.sellingPrice : pricing.sellingPrice,
                          realEstateFee: pricing.realEstateFee,
                          finalSellingPrice: pricing.finalSellingPrice,
                        });
                      }}
                      placeholder="e.g. 5.5"
                      required={!isPriceOverride}
                      disabled={isPriceOverride}
                    />
                  </div>

                  {/* Loan Amount for Land properties */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <span>Loan Amount (Nu.)</span>
                      <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={step1Data.loanAmount}
                      onChange={(e) => setStep1Data({ ...step1Data, loanAmount: e.target.value })}
                      placeholder="Enter loan amount if applicable"
                    />
                  </div>

                  {/* ── ADMIN OVERRIDE ───────────────────────────────────── */}
                  {isAdmin && (
                    <div className="space-y-3 sm:col-span-2 p-4 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-amber-700 dark:text-amber-400 font-semibold">Admin Price Override</Label>
                          <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                            Manually set selling price instead of auto-calculation
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={isPriceOverride}
                            onChange={(e) => setIsPriceOverride(e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-500"></div>
                        </label>
                      </div>
                      {isPriceOverride && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-3"
                        >
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Manual Selling Price (Nu.) *</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={step1Data.sellingPrice}
                                onChange={(e) => {
                                  const price = e.target.value;
                                  const fee = price ? (parseFloat(price) * 0.03).toFixed(2) : "";
                                  setStep1Data({
                                    ...step1Data,
                                    sellingPrice: price,
                                    realEstateFee: fee,
                                  });
                                }}
                                placeholder="Enter manual selling price"
                                required={isPriceOverride}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Commission (3%)</Label>
                              <Input
                                value={step1Data.realEstateFee}
                                readOnly
                                className="bg-slate-50 dark:bg-slate-800"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Override Reason *</Label>
                            <Textarea
                              value={step1Data.priceOverrideReason}
                              onChange={(e) => setStep1Data({ ...step1Data, priceOverrideReason: e.target.value })}
                              placeholder="Explain why you are overriding the auto-calculated price..."
                              required={isPriceOverride}
                              className="min-h-[80px]"
                            />
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* ── PRICING SUMMARY CARD ─────────────────────────────── */}
                  <div className="sm:col-span-2">
                    <PricingSummaryCard
                      landSize={step1Data.landSizeDecimal}
                      pricePerDecimal={step1Data.pricePerDecimal}
                      sellingPrice={isPriceOverride ? step1Data.sellingPrice : calculatePricing().sellingPrice}
                      finalSellingPrice={calculatePricing().finalSellingPrice}
                      commission={calculatePricing().realEstateFee}
                      isOverride={isPriceOverride}
                    />
                  </div>
                </>
              )}

              {/* ── STANDARD SELLING PRICE (Non-Land types) ──────────────── */}
              {!(isLandType || isEditingLand) && (
                <>
                  <div className="space-y-2">
                    <Label>Selling Price (Nu.) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={step1Data.sellingPrice}
                      onChange={(e) => {
                        const price = e.target.value;
                        setStep1Data({
                          ...step1Data,
                          sellingPrice: price,
                          realEstateFee: price ? (parseFloat(price) * 0.03).toFixed(2) : "",
                        });
                      }}
                      placeholder="Enter selling price"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Commission (3%)</Label>
                    <Input
                      value={step1Data.realEstateFee}
                      readOnly
                      className="bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  {/* Land Size for non-Land properties */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <span>Land Size (Decimal)</span>
                      <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={step1Data.landSizeDecimal}
                      onChange={(e) => setStep1Data({ ...step1Data, landSizeDecimal: e.target.value })}
                      placeholder="e.g. 5.5"
                    />
                  </div>
                  {/* Loan Amount for non-Land properties */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <span>Loan Amount (Nu.)</span>
                      <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={step1Data.loanAmount}
                      onChange={(e) => setStep1Data({ ...step1Data, loanAmount: e.target.value })}
                      placeholder="Enter loan amount if applicable"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2 sm:col-span-2">
                <Label>Address *</Label>
                <Textarea
                  value={step1Data.address}
                  onChange={(e) => setStep1Data({ ...step1Data, address: e.target.value })}
                  placeholder="Full property address"
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <GoogleMapPicker
                  value={{ lat: step1Data.latitude, lng: step1Data.longitude }}
                  onChange={(data) => {
                    setStep1Data({
                      ...step1Data,
                      latitude: data.lat,
                      longitude: data.lng,
                      address: data.address || step1Data.address
                    });
                  }}
                  label="Pin Location"
                />
              </div>

              <div className="space-y-4 sm:col-span-2">
                <Separator />
                <CloudinaryUpload
                  value={step1Data.images}
                  onChange={(images) => setStep1Data({ ...step1Data, images })}
                  label="Property Gallery"
                />
              </div>

              <div className="space-y-4 sm:col-span-2">
                <Separator />
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Property Features</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const currentFeatures = step1Data.features || {};
                      // Add a new empty feature with a unique key
                      let newKey = "New Feature";
                      let count = 1;
                      while (newKey in currentFeatures) {
                        newKey = `New Feature ${count}`;
                        count++;
                      }
                      setStep1Data({
                        ...step1Data,
                        features: { ...currentFeatures, [newKey]: "" }
                      });
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Feature
                  </Button>
                </div>
                {Object.entries(step1Data.features || {}).map(([key, value], index) => (
                  <div key={`feature-${index}`} className="flex flex-col sm:flex-row gap-2 items-start">
                    <Input
                      placeholder="Feature Name (e.g., Bedrooms, Land Area)"
                      defaultValue={key}
                      onBlur={(e) => {
                        const newKey = e.target.value.trim();
                        // If emptied, delete this feature
                        if (newKey === "") {
                          const newFeatures = { ...step1Data.features };
                          delete newFeatures[key];
                          setStep1Data({ ...step1Data, features: newFeatures });
                          return;
                        }
                        // Prevent duplicate keys
                        if (newKey !== key && step1Data.features[newKey]) {
                          toast.error("Feature key already exists");
                          e.target.value = key; // revert
                          return;
                        }
                        // Rename key
                        const newFeatures: Record<string, string> = {};
                        Object.entries(step1Data.features).forEach(([k, v]) => {
                          if (k !== key) newFeatures[k] = String(v ?? "");
                        });
                        newFeatures[newKey] = String(value ?? "");
                        setStep1Data({ ...step1Data, features: newFeatures });
                      }}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value (e.g., 3, 5.5 decimal)"
                      defaultValue={value}
                      onBlur={(e) => {
                        const newFeatures = { ...step1Data.features };
                        newFeatures[key] = e.target.value;
                        setStep1Data({ ...step1Data, features: newFeatures });
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="text-red-500 border-red-200 hover:bg-red-50"
                      onClick={() => {
                        const newFeatures = { ...step1Data.features };
                        delete newFeatures[key];
                        setStep1Data({ ...step1Data, features: newFeatures });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-semibold mb-3">Owner Information</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Owner Name *</Label>
                  <Input
                    value={step1Data.ownerName}
                    onChange={(e) => setStep1Data({ ...step1Data, ownerName: e.target.value })}
                    placeholder="Full name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Owner CID (11 digits) *</Label>
                  <Input
                    value={step1Data.ownerCID}
                    onChange={(e) => setStep1Data({ ...step1Data, ownerCID: e.target.value })}
                    placeholder="10704001234"
                    maxLength={11}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Owner Phone *</Label>
                  <Input
                    value={step1Data.ownerPhone}
                    onChange={(e) => setStep1Data({ ...step1Data, ownerPhone: e.target.value })}
                    placeholder="+975-17XXXXXX"
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Owner Address *</Label>
                  <Textarea
                    value={step1Data.ownerAddress}
                    onChange={(e) => setStep1Data({ ...step1Data, ownerAddress: e.target.value })}
                    placeholder="Full address"
                    required
                  />
                </div>
                {/* ── THRAM & PLOT NUMBER (All property types) ───────────── */}
                <div className="space-y-2">
                  <Label>Thram Number *</Label>
                  <Input
                    value={step1Data.thramNumber}
                    onChange={(e) => setStep1Data({ ...step1Data, thramNumber: e.target.value })}
                    placeholder="e.g. TH-2024-001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plot Number *</Label>
                  <Input
                    value={step1Data.plotNumber}
                    onChange={(e) => setStep1Data({ ...step1Data, plotNumber: e.target.value })}
                    placeholder="e.g. P-45-A"
                    required
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>No Objection Letter</Label>
              <FileUploader
                accept={DOCUMENT_UPLOAD_ACCEPT}
                maxSize={10 * 1024 * 1024}
                value={step1Data.noObjectionLetter}
                onChange={(url) => setStep1Data({ ...step1Data, noObjectionLetter: url })}
                label="Upload No Objection Letter"
                hint="Upload the No Objection Letter from the owner (PDF, Word, or image)"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              {propertyId && (
                <Button 
                  type="button" 
                  variant="outline" 
                  disabled={updateMutation.isPending}
                  onClick={async () => {
                    try {
                      await updateMutation.mutateAsync({ id: propertyId, ...buildStep1Payload() });
                      navigateToStep(2);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to save property");
                    }
                  }}
                >
                  {updateMutation.isPending ? "Saving..." : "Next Step"}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/20 w-full sm:w-auto"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : (propertyId ? "Update & Resubmit" : isAdmin ? "Create Property" : "Submit Property Info")}
                  <Send className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            </div>
          </form>
        );

      case 2:
        return (
          <form onSubmit={handleStep2Submit} className="space-y-5">
            {rejectionReason && existingProperty?.property?.approvalStatus === "rejected" && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">Step Rejected by Admin</p>
                  <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">{rejectionReason}</p>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold mb-3">Buyer Information *</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Buyer Name *</Label>
                  <Input
                    value={step2Data.buyerName}
                    onChange={(e) => setStep2Data({ ...step2Data, buyerName: e.target.value })}
                    placeholder="Full name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Buyer CID (11 digits) *</Label>
                  <Input
                    value={step2Data.buyerCID}
                    onChange={(e) => setStep2Data({ ...step2Data, buyerCID: e.target.value })}
                    placeholder="10704001234"
                    maxLength={11}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Buyer Phone *</Label>
                  <Input
                    value={step2Data.buyerPhone}
                    onChange={(e) => setStep2Data({ ...step2Data, buyerPhone: e.target.value })}
                    placeholder="+975-17XXXXXX"
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Buyer Address *</Label>
                  <Textarea
                    value={step2Data.buyerAddress}
                    onChange={(e) => setStep2Data({ ...step2Data, buyerAddress: e.target.value })}
                    placeholder="Full address"
                    required
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span>All files — including the property agreement — are uploaded together in Step 3 (Documents).</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Commission Amount</Label>
                  <Input
                    type="number"
                    value={step2Data.commissionAmount}
                    onChange={(e) => setStep2Data({ ...step2Data, commissionAmount: e.target.value })}
                    placeholder="Auto-calculated from price"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total Amount Paid *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={step2Data.totalAmountPaid}
                    onChange={(e) => setStep2Data({ ...step2Data, totalAmountPaid: e.target.value })}
                    placeholder="Enter total amount paid"
                  />
                  <p className="text-xs text-muted-foreground">Total amount received from the buyer (any number of payments).</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigateToStep(1)}
                className="w-full sm:w-auto"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <LinkToProperty id={propertyId} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    // Auto-save step 2 before navigating forward
                    if (step2Data.totalAmountPaid.trim() && step2Data.buyerName.trim()) {
                      submitStep2Mutation.mutate({
                        propertyId: propertyId!,
                        ...step2Data,
                        commissionAmount: step2Data.commissionAmount || undefined,
                        totalAmountPaid: step2Data.totalAmountPaid || undefined,
                      }, {
                        onSuccess: () => navigateToStep(3),
                      });
                    } else {
                      navigateToStep(3);
                    }
                  }}
                  className="w-full sm:w-auto"
                >
                  Next Step
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/20 w-full sm:w-auto"
                  disabled={submitStep2Mutation.isPending}
                >
                  {submitStep2Mutation.isPending
                    ? "Submitting..."
                    : existingProperty?.agreement
                      ? "Update & Save"
                      : "Save & Proceed"}
                  <Send className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
        );

      case 3: {
        const propData = existingProperty?.property;
        const typeName = propData?.propertyTypeName ?? "";
        const selectedType = propertyTypes?.find(pt => pt.id === parseInt(step1Data.propertyTypeId));
        const typeNameFromForm = selectedType?.name ?? "";
        const finalTypeName = typeName || typeNameFromForm;
        const BUILDING_TYPES = ["Building", "Flat", "Apartment", "Duplex", "Bungalow"];
        const requiresBuildingDocs = BUILDING_TYPES.includes(finalTypeName);

        return (
          <form onSubmit={handleStep3Submit} className="space-y-5">
            {rejectionReason && existingProperty?.property?.approvalStatus === "rejected" && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">Step Rejected by Admin</p>
                  <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">{rejectionReason}</p>
                </div>
              </div>
            )}

            <div className="grid gap-6">
              <a
                href="https://esakor.nlcs.gov.bt"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium h-10 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors w-fit"
              >
                <ExternalLink className="h-4 w-4" />
                eSakor Portal
              </a>

              {/* ── BULK UPLOAD: pick every document in one go ──────────── */}
              <div className="space-y-3 rounded-xl border border-dashed p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Label className="text-base font-bold">Upload all documents at once</Label>
                    <p className="text-xs text-muted-foreground">
                      Select every file together — each one is matched to its document slot below.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={bulkUploading}
                    onClick={() => bulkInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Choose files
                  </Button>
                  <input
                    ref={bulkInputRef}
                    type="file"
                    multiple
                    accept={DOCUMENT_UPLOAD_ACCEPT}
                    className="hidden"
                    onChange={handleBulkFileSelect}
                    disabled={bulkUploading}
                  />
                </div>

                {bulkFiles.length > 0 && (
                  <div className="space-y-2">
                    {bulkFiles.map((item, index) => (
                      <div key={item.key} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-[140px] flex-1 truncate text-sm">{item.fileName}</span>
                        <Select
                          value={item.slot}
                          onValueChange={(v) =>
                            setBulkFiles((prev) =>
                              prev.map((f, i) => (i === index ? { ...f, slot: v as DocSlot } : f))
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-[220px] text-xs">
                            <SelectValue placeholder="Choose document type" />
                          </SelectTrigger>
                          <SelectContent>
                            {visibleDocSlots.map((slot) => (
                              <SelectItem key={slot} value={slot}>
                                {DOC_SLOT_LABEL[slot]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={bulkUploading}
                          onClick={() => setBulkFiles((prev) => prev.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleBulkAttach}
                        disabled={bulkUploading || bulkFiles.some((f) => !f.slot)}
                      >
                        {bulkUploading
                          ? `Uploading ${bulkProgress?.done ?? 0}/${bulkProgress?.total ?? 0}...`
                          : `Attach ${bulkFiles.length} file${bulkFiles.length === 1 ? "" : "s"}`}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setBulkFiles([])} disabled={bulkUploading}>
                        Clear
                      </Button>
                      {bulkFiles.some((f) => !f.slot) && (
                        <span className="text-xs text-muted-foreground">Choose a document type for every file first.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Property Agreement File *</Label>
                  <FileUploader
                    accept={DOCUMENT_UPLOAD_ACCEPT}
                    maxSize={10 * 1024 * 1024}
                    value={step3Data.agreementFile}
                    onChange={(url) => setStep3Data({ ...step3Data, agreementFile: url })}
                    label="Upload agreement"
                    hint="Signed property agreement document (PDF, Word or image)"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Gewog Endorse Document *</Label>
                  <FileUploader
                    accept={DOCUMENT_UPLOAD_ACCEPT}
                    maxSize={10 * 1024 * 1024}
                    value={step3Data.gewogCertification}
                    onChange={(url) => setStep3Data({ ...step3Data, gewogCertification: url })}
                    label="Upload document"
                    hint="Upload the official endorsement from the Gewog office"
                  />
                </div>

                {requiresBuildingDocs && (
                  <>
                    <div className="space-y-2">
                      <Label>Internal Agreement</Label>
                      <FileUploader
                        accept={DOCUMENT_UPLOAD_ACCEPT}
                        maxSize={10 * 1024 * 1024}
                        value={step3Data.internalAgreement}
                        onChange={(url) => setStep3Data({ ...step3Data, internalAgreement: url })}
                        label="Upload agreement"
                        hint="Upload the internal agreement document"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Occupancy Certificate</Label>
                      <FileUploader
                        accept={DOCUMENT_UPLOAD_ACCEPT}
                        maxSize={10 * 1024 * 1024}
                        value={step3Data.occupancyCertificate}
                        onChange={(url) => setStep3Data({ ...step3Data, occupancyCertificate: url })}
                        label="Upload certificate"
                        hint="Upload the occupancy certificate for the building"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>PLR Verification</Label>
                      <FileUploader
                        accept={DOCUMENT_UPLOAD_ACCEPT}
                        maxSize={10 * 1024 * 1024}
                        value={step3Data.plrVerification}
                        onChange={(url) => setStep3Data({ ...step3Data, plrVerification: url })}
                        label="Upload verification"
                        hint="Upload the PLR verification document"
                      />
                    </div>
                  </>
                )}
              </div>

            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigateToStep(2)}
                className="w-full sm:w-auto"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <LinkToProperty id={propertyId} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    // Auto-save step 3 before navigating forward
                    const hasRequiredDocs = step3Data.agreementFile && step3Data.gewogCertification;

                    if (hasRequiredDocs) {
                      submitStep3Mutation.mutate({
                        propertyId: propertyId!,
                        ...step3Data,
                      }, {
                        onSuccess: () => navigateToStep(4),
                      });
                    } else {
                      navigateToStep(4);
                    }
                  }}
                  className="w-full sm:w-auto"
                >
                  Next Step
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/20 w-full sm:w-auto"
                  disabled={submitStep3Mutation.isPending}
                >
                  {submitStep3Mutation.isPending
                    ? "Submitting..."
                    : existingProperty?.documents
                      ? "Update & Save"
                      : "Save & Proceed"}
                  <Send className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
        );
      }

      case 4:
        return (
          <form onSubmit={handleStep4Submit} className="space-y-5">
            {rejectionReason && existingProperty?.property?.approvalStatus === "rejected" && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">Step Rejected by Admin</p>
                  <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">{rejectionReason}</p>
                </div>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Lagthram Processing</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={step4Data.lagthramStatus}
                    onValueChange={(v: "pending" | "processing" | "completed") =>
                      setStep4Data({ ...step4Data, lagthramStatus: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Loan Processing</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={step4Data.loanStatus}
                    onValueChange={(v: "pending" | "processing" | "completed") =>
                      setStep4Data({ ...step4Data, loanStatus: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>
            <p className="text-sm text-muted-foreground">
              Both lagthram processing and loan processing must be completed before moving to the final step.
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigateToStep(3)}
                className="w-full sm:w-auto"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <LinkToProperty id={propertyId} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigateToStep(5)}
                  className="w-full sm:w-auto"
                >
                  Next Step
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/20 w-full sm:w-auto"
                  disabled={submitStep4Mutation.isPending}
                >
                  {submitStep4Mutation.isPending
                    ? "Updating..."
                    : step4Data.lagthramStatus === "completed" && step4Data.loanStatus === "completed"
                      ? "Complete Verification"
                      : "Update Progress"}
                  <Send className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
        );

      case 5:
        return (
          <form onSubmit={handleStep5Submit} className="space-y-5">
            {rejectionReason && existingProperty?.property?.approvalStatus === "rejected" && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">Step Rejected by Admin</p>
                  <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">{rejectionReason}</p>
                </div>
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Final Lagthram Document *</Label>
                <FileUploader
                  accept={DOCUMENT_UPLOAD_ACCEPT}
                  maxSize={10 * 1024 * 1024}
                  value={step5Data.finalDocument}
                  onChange={(url) => setStep5Data({ ...step5Data, finalDocument: url })}
                  label="Upload final lagthram"
                  hint="Upload the final lagthram document (PDF, Word, or image)"
                />
              </div>
              <div className="space-y-2">
                <Label>Completion Certificate</Label>
                <FileUploader
                  accept={DOCUMENT_UPLOAD_ACCEPT}
                  maxSize={10 * 1024 * 1024}
                  value={step5Data.completionCertificate}
                  onChange={(url) => setStep5Data({ ...step5Data, completionCertificate: url })}
                  label="Upload certificate"
                  hint="Leave empty to use the system-generated Bhutanese certificate displayed on the property page"
                />
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigateToStep(4)}
                className="w-full sm:w-auto"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <LinkToProperty id={propertyId} />
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/20 w-full sm:w-auto"
                  disabled={submitStep5Mutation.isPending || (!isAdmin && existingProperty?.finalLagthram?.approvalStatus === "pending" && existingProperty?.property?.approvalStatus === "pending_review")}
                >
                  {submitStep5Mutation.isPending
                    ? "Submitting..."
                    : isAdmin
                      ? (existingProperty?.finalLagthram ? "Update & Complete" : "Complete Property")
                      : existingProperty?.finalLagthram?.approvalStatus === "pending" && existingProperty?.property?.approvalStatus === "pending_review"
                        ? "Pending Approval"
                        : existingProperty?.finalLagthram?.approvalStatus === "rejected"
                          ? "Resubmit for Approval"
                          : existingProperty?.finalLagthram
                            ? "Update & Resubmit"
                            : "Submit for Final Approval"}
                  <Send className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
        );
    }
  };

  if (propertyId && existingProperty === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading property workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {propertyId ? "Continue Workflow" : "New Property Listing"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Complete the 5-step workflow process
        </p>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto pb-2">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const isRejected = existingProperty?.property?.approvalStatus === "rejected" && existingProperty?.property?.currentStep === step.id;
          
          // Allow navigation to: current step, completed steps, or rejected step
          const isAccessible = isAdmin || step.id <= (existingProperty?.property?.currentStep || 1) || isRejected;

          return (
            <div key={step.id} className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
              <motion.div
                whileHover={isAccessible ? { scale: 1.02, y: -2 } : {}}
                whileTap={isAccessible ? { scale: 0.98 } : {}}
                onClick={() => {
                  if (isAccessible) {
                    setCurrentStep(step.id);
                    const basePath = propertyId ? `/properties/${propertyId}/wizard` : "/properties/new";
                    navigate(`${basePath}?step=${step.id}`, { replace: true });
                  }
                }}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ring-1 ring-inset ${
                  isActive
                    ? "bg-primary/10 text-primary ring-primary/25 dark:bg-primary/20 dark:text-primary-foreground"
                    : isRejected
                    ? "bg-red-100 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800/50 animate-pulse"
                    : isCompleted
                    ? "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700 hover:bg-primary/5 dark:hover:bg-primary/10"
                    : isAccessible
                    ? "text-muted-foreground ring-border/60 hover:bg-slate-50 dark:hover:bg-slate-800"
                    : "text-muted-foreground ring-border/40 opacity-50 cursor-not-allowed"
                }`}
              >
                <step.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:block truncate min-w-0">{step.label}</span>
                {isRejected && <span className="text-[10px] shrink-0">(Rejected)</span>}
              </motion.div>
              {index < steps.length - 1 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card className="border-border/50 bg-white/70 backdrop-blur-sm dark:bg-slate-800/70">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {(() => {
              const StepIcon = steps[currentStep - 1]?.icon || Building2;
              return <StepIcon className="h-5 w-5 text-primary" />;
            })()}
            {steps[currentStep - 1]?.label}
          </CardTitle>
          <CardDescription>
            {currentStep === 1 && "Enter property details and owner information"}
            {currentStep === 2 && "Enter buyer details, commission and the total amount paid"}
            {currentStep === 3 && "Upload the property agreement and all required documents at once"}
            {currentStep === 4 && "Update lagthram and loan verification status"}
            {currentStep === 5 && "Upload final documents for completion"}
            {isAdmin && <span className="block text-xs text-green-600 dark:text-green-400 mt-1">Admin: Steps will auto-approve on submission</span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}

function LinkToProperty({ id }: { id?: number }) {
  if (!id) return null;
  return (
    <Link to={`/properties/${id}`}>
      <Button type="button" variant="outline">
        Cancel
      </Button>
    </Link>
  );
}

// ── PRICING SUMMARY CARD COMPONENT ──────────────────────────────────
function PricingSummaryCard({
  landSize,
  pricePerDecimal,
  sellingPrice,
  finalSellingPrice,
  commission,
  isOverride,
}: {
  landSize: string;
  pricePerDecimal: string;
  sellingPrice: string;
  finalSellingPrice: string;
  commission: string;
  isOverride: boolean;
}) {
  const fmt = (val: string | number) => {
    const n = typeof val === "string" ? parseFloat(val || "0") : val;
    if (isNaN(n) || n === 0) return "Nu. 0.00";
    return `Nu. ${n.toLocaleString("en-BT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const hasLandPricing = parseFloat(landSize || "0") > 0 && parseFloat(pricePerDecimal || "0") > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-emerald-100 dark:border-emerald-800/40 bg-gradient-to-br from-white via-emerald-50/30 to-white dark:from-slate-900 dark:via-emerald-950/20 dark:to-slate-900 shadow-lg shadow-emerald-100/50 dark:shadow-emerald-900/20 overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-3 border-b border-emerald-100 dark:border-emerald-800/30 bg-gradient-to-r from-emerald-600 to-teal-600">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-white" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pricing Summary</h3>
          {isOverride && (
            <span className="ml-auto text-xs font-semibold text-amber-200 bg-amber-600/30 px-2 py-0.5 rounded-full">
              Admin Override
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Land Size & Price Per Decimal */}
        {hasLandPricing && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Ruler className="h-3 w-3" />
                <span>Land Size</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{parseFloat(landSize).toFixed(4)} decimal</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Tag className="h-3 w-3" />
                <span>Price Per Decimal</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{fmt(pricePerDecimal)}</p>
            </div>
          </div>
        )}

        {/* Divider */}
        {hasLandPricing && <div className="h-px bg-emerald-100 dark:bg-emerald-800/30" />}

        {/* Gross Selling Price */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Gross Selling Price</span>
          <span className="text-sm font-medium text-foreground">{fmt(sellingPrice)}</span>
        </div>

        {/* Divider */}
        <div className="h-px bg-emerald-200 dark:bg-emerald-700/40" />

        {/* Final Selling Price — Highlighted */}
        <motion.div
          key={finalSellingPrice}
          initial={{ scale: 1.02 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 dark:from-emerald-500/20 dark:via-teal-500/20 dark:to-emerald-500/20 border border-emerald-200 dark:border-emerald-700/50 p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Final Selling Price
              </p>
              <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70 mt-0.5">
                Amount used for billing & agreements
              </p>
            </div>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {fmt(finalSellingPrice)}
            </p>
          </div>
        </motion.div>

        {/* Commission */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground">Commission (3%)</span>
          <span className="text-xs font-medium text-muted-foreground">{fmt(commission)}</span>
        </div>
      </div>
    </motion.div>
  );
}
