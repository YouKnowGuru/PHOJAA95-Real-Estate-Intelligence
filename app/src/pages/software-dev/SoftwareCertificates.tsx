import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { AppleCard } from "@/components/ui/apple-card";
import { OniLoader } from "@/components/ui/oni-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Award, Eye, Shield, FileCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function SoftwareCertificates() {
  useAuth();
  const [viewCertificate, setViewCertificate] = useState<any>(null);
  const [verifyNumber, setVerifyNumber] = useState("");
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const { data, isLoading } = trpc.softwareCertificate.list.useQuery({ page: 1, limit: 50 });
  const { data: stats } = trpc.softwareCertificate.stats.useQuery();
  const [isVerifying, setIsVerifying] = useState(false);
  const utils = trpc.useUtils();
  
  const handleVerify = async () => {
    if (!verifyNumber.trim()) return;
    setIsVerifying(true);
    try {
      const result = await utils.client.softwareCertificate.verify.query({ verificationNumber: verifyNumber });
      setVerifyResult(result);
    } catch {
      setVerifyResult(null);
      alert("Invalid verification number");
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <OniLoader size="lg" text="Loading certificates..." />
      </div>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        title="Certificates"
        description="Software ownership and completion certificates"
        icon={<Award className="h-5 w-5" />}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <AppleCard className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Award className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold">{stats?.total || 0}</p>
          </div>
        </AppleCard>
        <AppleCard className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
            <FileCheck className="h-4 w-4 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Completion</p>
            <p className="text-lg font-bold">{stats?.completion || 0}</p>
          </div>
        </AppleCard>
        <AppleCard className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Shield className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ownership</p>
            <p className="text-lg font-bold">{stats?.ownership || 0}</p>
          </div>
        </AppleCard>
      </div>

      {/* Verification */}
      <AppleCard className="mb-6">
        <h3 className="text-sm font-medium mb-3">Verify Certificate</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={verifyNumber}
            onChange={(e) => setVerifyNumber(e.target.value)}
            placeholder="Enter verification number"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <Button onClick={handleVerify} disabled={isVerifying}>
            {isVerifying ? "Verifying..." : "Verify"}
          </Button>
        </div>
        {verifyResult && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
              <Shield className="h-4 w-4" />
              <span className="font-semibold">Certificate Verified</span>
            </div>
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Certificate #:</span> {verifyResult.certificateNumber}</p>
              <p><span className="text-muted-foreground">Customer:</span> {verifyResult.customerName}</p>
              <p><span className="text-muted-foreground">Product:</span> {verifyResult.productName}</p>
              <p><span className="text-muted-foreground">Completion Date:</span> {verifyResult.completionDate}</p>
            </div>
          </div>
        )}
      </AppleCard>

      {/* Certificates Table */}
      <AppleCard>
        {data?.items && data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 font-medium">Certificate #</th>
                  <th className="text-left py-3 px-4 font-medium">Type</th>
                  <th className="text-left py-3 px-4 font-medium">Customer</th>
                  <th className="text-left py-3 px-4 font-medium">Product</th>
                  <th className="text-left py-3 px-4 font-medium">Completion Date</th>
                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((cert: any) => (
                  <tr key={cert.id} className="border-b border-border/30 hover:bg-accent/50">
                    <td className="py-3 px-4 font-mono text-xs">{cert.certificateNumber}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        cert.certificateType === "project_completion"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      }`}>
                        {cert.certificateType === "project_completion" ? (
                          <FileCheck className="h-3 w-3" />
                        ) : (
                          <Shield className="h-3 w-3" />
                        )}
                        {cert.certificateType === "project_completion" ? "Completion" : "Ownership"}
                      </span>
                    </td>
                    <td className="py-3 px-4">{cert.customerName}</td>
                    <td className="py-3 px-4">{cert.productName}</td>
                    <td className="py-3 px-4">{cert.completionDate}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewCertificate(cert)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No certificates found"
            description="Certificates are automatically generated when projects are completed and payments are fully received."
            icon={Award}
          />
        )}
      </AppleCard>

      {/* View Certificate Dialog */}
      <Dialog open={!!viewCertificate} onOpenChange={() => setViewCertificate(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Certificate {viewCertificate?.certificateNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Type:</span>
              <span className="capitalize">{viewCertificate?.certificateType?.replace(/_/g, " ")}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Customer:</span>
              <span>{viewCertificate?.customerName}</span>
            </div>
            {viewCertificate?.companyName && (
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Company:</span>
                <span>{viewCertificate.companyName}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Product:</span>
              <span>{viewCertificate?.productName}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Version:</span>
              <span>{viewCertificate?.productVersion}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Completion Date:</span>
              <span>{viewCertificate?.completionDate}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Warranty:</span>
              <span>{viewCertificate?.warrantyPeriod} months</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Maintenance:</span>
              <span>{viewCertificate?.maintenancePeriod} months</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Developer:</span>
              <span>{viewCertificate?.developerName}</span>
            </div>
            <div className="pt-3 border-t border-border/30">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3 w-3" />
                <span className="font-mono">Verification: {viewCertificate?.verificationNumber}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
