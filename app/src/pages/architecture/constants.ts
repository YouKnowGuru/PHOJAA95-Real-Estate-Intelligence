import {
  LayoutDashboard, Briefcase, UserCheck, ShoppingCart, CreditCard,
  FileText, Award, FolderTree, PieChart, Files,
} from "lucide-react";

export const ARCHITECTURE_TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "projects", label: "Projects", icon: Briefcase },
  { id: "customers", label: "Customers", icon: UserCheck },
  { id: "orders", label: "Orders", icon: ShoppingCart },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "invoices", label: "Invoices", icon: FileText },
  { id: "certificates", label: "Certificates", icon: Award },
  { id: "documents", label: "Documents", icon: Files },
  { id: "categories", label: "Categories", icon: FolderTree },
  { id: "reports", label: "Reports", icon: PieChart },
] as const;

export type ArchitectureTabId = (typeof ARCHITECTURE_TABS)[number]["id"];

export const VALID_ARCHITECTURE_TAB_IDS = new Set<string>(
  ARCHITECTURE_TABS.map((t) => t.id)
);

export function getInitialArchitectureTab(): ArchitectureTabId {
  const hash = window.location.hash.replace(/^#/, "");
  if (VALID_ARCHITECTURE_TAB_IDS.has(hash)) return hash as ArchitectureTabId;
  return "dashboard";
}

export const DEV_STAGES = [
  { value: "planning", label: "Planning" },
  { value: "draft_design", label: "Draft Design" },
  { value: "review", label: "Review" },
  { value: "revision", label: "Revision" },
  { value: "final_design", label: "Final Design" },
  { value: "completed", label: "Completed" },
] as const;
