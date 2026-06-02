import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AppleCard } from "@/components/ui/apple-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OniLoader } from "@/components/ui/oni-loader";
import { toast } from "sonner";
import {
  ArchitectureCertificateViewDialog,
  downloadArchitectureCertificatePdf,
  printArchitectureCertificate,
  type ArchCertificateRecord,
} from "@/components/architecture";
import { SoftwareTabPanel } from "@/components/software-dev";
import { formatDisplayDate } from "@/lib/format-date";
import { TabSectionHeader } from "../TabSectionHeader";
import { Award, Download, Eye, Printer, Shield, FileCheck } from "lucide-react";

export default function CertificatesTab() {
  const [viewCert, setViewCert] = useState<ArchCertificateRecord | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyResult, setVerifyResult] = useState<ArchCertificateRecord | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const utils = trpc.useUtils();
  const { data: certificates, isLoading } = trpc.architectureCertificate.list.useQuery({ page: 1, limit: 50 });
  const { data: branding } = trpc.settings.getPublicSettings.useQuery(undefined, { staleTime: 0 });

  const handleVerify = async () => {
    if (!verifyInput.trim()) return;
    setVerifyLoading(true);
    setVerifyResult(null);
    try {
      const cert = await utils.architectureCertificate.verify.fetch({ verificationNumber: verifyInput.trim() });
      setVerifyResult(cert);
    } catch {
      toast.error("Invalid verification number");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handlePrint = async (cert: ArchCertificateRecord) => {
    if (!branding) return;
    try {
      await printArchitectureCertificate(cert, branding);
      toast.success("Opening print dialog…");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to print");
    }
  };

  const handleDownload = async (cert: ArchCertificateRecord) => {
    if (!branding) return;
    try {
      await downloadArchitectureCertificatePdf(cert, branding);
      toast.success("Certificate PDF downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download PDF");
    }
  };

  if (isLoading) {
    return (
      <SoftwareTabPanel>
        <div className="flex h-64 items-center justify-center"><OniLoader size="lg" text="Loading certificates" /></div>
      </SoftwareTabPanel>
    );
  }

  return (
    <SoftwareTabPanel>
      <TabSectionHeader
        title="Design Certificates"
        description="Premium single-page A4 landscape certificates — view, print, or download."
        actions={
          <Button variant="outline" size="sm" onClick={() => { setVerifyOpen(true); setVerifyInput(""); setVerifyResult(null); }}>
            Verify Certificate
          </Button>
        }
      />

      <AppleCard hover={false} className="mb-6 p-4">
        <p className="text-sm text-muted-foreground">
          Certificates are issued automatically when an order is <strong>completed</strong> and <strong>fully paid & verified</strong>.
          Use View to preview the official certificate, then Print or Download PDF.
        </p>
      </AppleCard>

      {!certificates?.items.length ? (
        <EmptyState
          title="No certificates yet"
          description="Complete the order, verify full payment, and a certificate will be generated automatically."
          icon={Award}
        />
      ) : (
        <AppleCard hover={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium">Certificate #</th>
                  <th className="px-4 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Project</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-left font-medium">Completion</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {certificates.items.map((cert) => (
                  <tr key={cert.id} className="border-b border-border/30 hover:bg-accent/40">
                    <td className="px-4 py-3 font-mono text-xs">{cert.certificateNumber}</td>
                    <td className="px-4 py-3">{cert.customerName}</td>
                    <td className="px-4 py-3">{cert.projectName}</td>
                    <td className="px-4 py-3">{cert.projectCategory}</td>
                    <td className="px-4 py-3">{formatDisplayDate(cert.completionDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setViewCert(cert)}>
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 gap-1" disabled={!branding} onClick={() => handlePrint(cert)}>
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 gap-1" disabled={!branding} onClick={() => handleDownload(cert)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppleCard>
      )}

      <ArchitectureCertificateViewDialog open={!!viewCert} onClose={() => setViewCert(null)} certificate={viewCert} />

      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Verify Certificate</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={verifyInput}
              onChange={(e) => setVerifyInput(e.target.value)}
              placeholder="Enter verification number"
            />
            <Button onClick={handleVerify} disabled={verifyLoading}>
              {verifyLoading ? "..." : "Verify"}
            </Button>
          </div>
          {verifyResult && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/40 dark:bg-green-950/20">
              <div className="mb-2 flex items-center gap-2 font-semibold text-green-700 dark:text-green-400">
                <FileCheck className="h-4 w-4" /> Certificate Verified
              </div>
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Certificate #:</span> {verifyResult.certificateNumber}</p>
                <p><span className="text-muted-foreground">Customer:</span> {verifyResult.customerName}</p>
                <p><span className="text-muted-foreground">Project:</span> {verifyResult.projectName}</p>
                <p><span className="text-muted-foreground">Completion:</span> {formatDisplayDate(verifyResult.completionDate)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SoftwareTabPanel>
  );
}
