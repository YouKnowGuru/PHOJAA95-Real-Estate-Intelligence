import { useParams } from "react-router";
import { trpc } from "@/lib/trpc";
import { OniLoader } from "@/components/ui/oni-loader";
import { AppleCard } from "@/components/ui/apple-card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, XCircle } from "lucide-react";
import { formatDisplayDate } from "@/lib/format-date";

export default function VerifyArchitectureCertificatePage() {
  const { verificationNumber } = useParams<{ verificationNumber: string }>();
  const { data, isLoading, error } = trpc.architecturePortal.verifyCertificate.useQuery(
    { verificationNumber: verificationNumber || "" },
    { enabled: !!verificationNumber }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <OniLoader size="lg" text="Verifying certificate" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <AppleCard className="p-8 max-w-lg w-full text-center">
        {error || !data ? (
          <>
            <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h1 className="text-xl font-bold">Invalid Certificate</h1>
            <p className="text-muted-foreground mt-2">The verification ID could not be found. This certificate may be fraudulent or expired.</p>
          </>
        ) : (
          <>
            <ShieldCheck className="h-16 w-16 mx-auto text-green-600 mb-4" />
            <Badge className="mb-4 bg-green-600">Verified Authentic</Badge>
            <h1 className="text-xl font-bold">Architecture Design Certificate</h1>
            <p className="text-muted-foreground mt-1">{data.certificateNumber}</p>
            <div className="mt-6 space-y-2 text-left text-sm">
              <p><strong>Customer:</strong> {data.customerName}</p>
              <p><strong>Project:</strong> {data.projectName}</p>
              <p><strong>Category:</strong> {data.projectCategory}</p>
              <p><strong>Completion Date:</strong> {formatDisplayDate(data.completionDate)}</p>
              <p><strong>Architect:</strong> {(data as { staffName?: string | null }).staffName || "—"}</p>
              <p><strong>Issued By:</strong> {data.companyName}</p>
            </div>
          </>
        )}
      </AppleCard>
    </div>
  );
}
