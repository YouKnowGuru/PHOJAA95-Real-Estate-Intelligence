import { useAuth } from "@/hooks/useAuth";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { FileText } from "lucide-react";
import { SoftwareInvoicesTab } from "@/components/software-dev";

export default function SoftwareInvoices() {
  const { isAdmin } = useAuth();

  return (
    <AnimatedPage>
      <PageHeader
        title="Invoices"
        description="Professional software development invoices — preview, print, and download PDF"
        icon={<FileText className="h-5 w-5" />}
      />
      <SoftwareInvoicesTab isAdmin={isAdmin} />
    </AnimatedPage>
  );
}
