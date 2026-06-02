import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { AppleCard } from "@/components/ui/apple-card";
import { SoftwareTabNav } from "@/components/software-dev";
import {
  ARCHITECTURE_TABS,
  VALID_ARCHITECTURE_TAB_IDS,
  getInitialArchitectureTab,
  type ArchitectureTabId,
} from "./constants";
import "../software-dev/software-dev.css";
import { PenTool } from "lucide-react";

import DashboardTab from "./tabs/DashboardTab";
import ProjectsTab from "./tabs/ProjectsTab";
import CustomersTab from "./tabs/CustomersTab";
import OrdersTab from "./tabs/OrdersTab";
import PaymentsTab from "./tabs/PaymentsTab";
import InvoicesTab from "./tabs/InvoicesTab";
import CertificatesTab from "./tabs/CertificatesTab";
import DocumentsTab from "./tabs/DocumentsTab";
import CategoriesTab from "./tabs/CategoriesTab";
import ReportsTab from "./tabs/ReportsTab";

export default function ArchitecturePage() {
  const { isAdmin, isArchitectureStaff } = useAuth();
  const canManage = isArchitectureStaff;
  const [activeTab, setActiveTab] = useState<ArchitectureTabId>(getInitialArchitectureTab);

  useEffect(() => {
    const syncTabFromHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (VALID_ARCHITECTURE_TAB_IDS.has(hash)) {
        setActiveTab(hash as ArchitectureTabId);
      }
    };
    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);
    return () => window.removeEventListener("hashchange", syncTabFromHash);
  }, []);

  const selectTab = (tabId: string) => {
    setActiveTab(tabId as ArchitectureTabId);
    window.history.replaceState(null, "", `#${tabId}`);
  };

  return (
    <AnimatedPage className="max-w-full overflow-x-hidden pb-6">
      <PageHeader
        title="Architecture Management"
        description={isAdmin ? "Review projects, verify payments, and manage architecture operations" : "Manage projects, customers, orders, and design deliverables"}
        icon={<PenTool className="h-5 w-5" />}
      />

      {isAdmin && (
        <AppleCard hover={false} className="mb-6 border-amber-200/60 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Admin mode.</span>{" "}
            View full details on any card (View Details). Verify payments in the Payments tab. Delete records when needed. Staff upload payment screenshots — not admin.
          </p>
        </AppleCard>
      )}

      <SoftwareTabNav tabs={[...ARCHITECTURE_TABS]} activeTab={activeTab} onSelect={selectTab} />

      {activeTab === "dashboard" && <DashboardTab />}
      {activeTab === "projects" && <ProjectsTab isAdmin={isAdmin} canManage={canManage} />}
      {activeTab === "customers" && <CustomersTab isAdmin={isAdmin} canManage={canManage} />}
      {activeTab === "orders" && <OrdersTab isAdmin={isAdmin} canManage={canManage} />}
      {activeTab === "payments" && <PaymentsTab isAdmin={isAdmin} isArchitectureStaff={isArchitectureStaff} />}
      {activeTab === "invoices" && <InvoicesTab />}
      {activeTab === "certificates" && <CertificatesTab />}
      {activeTab === "documents" && <DocumentsTab canManage={canManage} />}
      {activeTab === "categories" && <CategoriesTab isAdmin={isAdmin} />}
      {activeTab === "reports" && <ReportsTab isAdmin={isAdmin} />}
    </AnimatedPage>
  );
}
