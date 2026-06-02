import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Award, Download, Printer, X } from "lucide-react";
import { OniLoader } from "@/components/ui/oni-loader";
import { formatDisplayDate } from "@/lib/format-date";
import { resolveSiteLogoForCertificate } from "@/lib/site-branding";
import {
  buildArchitectureCertificateHtml,
  downloadArchitectureCertificatePdf,
  printArchitectureCertificate,
  type ArchCertificateRecord,
} from "./architecture-certificate-export";

interface ArchitectureCertificateViewDialogProps {
  open: boolean;
  onClose: () => void;
  certificate: ArchCertificateRecord | null;
}

/** Single-page portrait architecture certificate preview. */
export function ArchitectureCertificateViewDialog({
  open,
  onClose,
  certificate,
}: ArchitectureCertificateViewDialogProps) {
  const { data: branding, isLoading: brandingLoading } = trpc.settings.getPublicSettings.useQuery(undefined, {
    enabled: open,
    staleTime: 0,
  });
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);

  useEffect(() => {
    if (!open || !branding?.site_logo?.trim()) {
      setLogoDataUrl(null);
      setLogoLoading(false);
      return;
    }

    let cancelled = false;
    setLogoLoading(true);
    resolveSiteLogoForCertificate(branding)
      .then((dataUrl) => {
        if (!cancelled) setLogoDataUrl(dataUrl);
      })
      .finally(() => {
        if (!cancelled) setLogoLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, branding?.site_logo, branding?.site_name]);

  if (!certificate) return null;

  const previewReady = !brandingLoading && !logoLoading;
  const previewHtml = previewReady
    ? buildArchitectureCertificateHtml(certificate, branding || {}, logoDataUrl)
    : "";

  const handlePrint = async () => {
    try {
      await printArchitectureCertificate(certificate, branding || {});
      toast.success("Opening print dialog…");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to print certificate");
    }
  };

  const handleDownload = async () => {
    try {
      await downloadArchitectureCertificatePdf(certificate, branding || {});
      toast.success("Certificate PDF downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate PDF");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[min(95dvh,920px)] w-[min(100vw-1rem,56rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="shrink-0 border-b px-4 py-3 text-left">
          <DialogTitle className="flex items-center gap-2 pr-8 text-base sm:text-lg">
            <Award className="h-5 w-5 shrink-0 text-slate-700" />
            Architecture Certificate {certificate.certificateNumber || ""}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-100/80 p-3 sm:p-4 dark:bg-slate-900/40">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-lg border bg-white shadow-sm">
            {!previewReady ? (
              <div className="flex aspect-[297/210] items-center justify-center">
                <OniLoader size="md" text="Loading certificate..." />
              </div>
            ) : (
              <iframe
                key={`${certificate.certificateNumber}-${logoDataUrl || "no-logo"}`}
                title="Architecture certificate preview"
                srcDoc={previewHtml}
                className="aspect-[297/210] w-full border-0 bg-white"
              />
            )}
          </div>

          <div className="mx-auto mt-3 grid max-w-4xl grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="font-medium">{certificate.customerName || "—"}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Project</p>
              <p className="font-medium">{certificate.projectName || "—"}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="font-medium">{certificate.projectCategory || "—"}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Completion</p>
              <p className="font-medium">{formatDisplayDate(certificate.completionDate)}</p>
            </div>
            <div className="rounded-lg border bg-background p-3 sm:col-span-2">
              <p className="text-xs text-muted-foreground">Verification Number</p>
              <p className="font-mono text-xs font-medium">{certificate.verificationNumber || "—"}</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t bg-background px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-10 sm:order-1" onClick={onClose}>
            <X className="mr-1.5 h-4 w-4" />
            Close
          </Button>
          <Button type="button" variant="outline" className="min-h-10" onClick={handlePrint} disabled={brandingLoading}>
            <Printer className="mr-1.5 h-4 w-4" />
            Print
          </Button>
          <Button type="button" className="min-h-10" onClick={handleDownload} disabled={brandingLoading}>
            <Download className="mr-1.5 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
