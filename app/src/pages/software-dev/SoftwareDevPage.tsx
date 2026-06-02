import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import "./quill-overrides.css";
import "./software-dev.css";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { KPICard } from "@/components/ui/kpi-card";
import { AppleCard } from "@/components/ui/apple-card";
import { OniLoader } from "@/components/ui/oni-loader";
import { EmptyState } from "@/components/ui/empty-state";
// StatusBadge removed - not used in this file
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { FileUploader } from "@/components/FileUploader";
import {
  ApprovalDialog,
  DetailViewDialog,
  CertificateViewDialog,
  EntityCard,
  getCustomerLabel,
  CERTIFICATE_TYPES,
  formatStatusLabel,
  confirmEntityDelete,
  printCertificate,
  downloadCertificatePdf,
  SoftwareTabNav,
  SoftwarePagination,
  SoftwareTabPanel,
  softwareFormDialogClass,
  softwareDialogSmClass,
  softwareDialogMdClass,
  SoftwareInvoicesTab,
} from "@/components/software-dev";
import { TabToolbar, TabSearchWrap, tabSelectClass, tabActionClass } from "@/components/software-dev/TabToolbar";
import { exportReport } from "@/components/software-dev/report-export";
import {
  Code2,
  LayoutDashboard,
  Package,
  Briefcase,
  UserCheck,
  ShoppingCart,
  CreditCard,
  FileText,
  Award,
  Files,
  PieChart,
  KanbanSquare,
  DollarSign,
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle,
  Search,
  Plus,
  ArrowRight,
  ArrowLeft,
  Calendar,
  User,
  Download,
  FileSpreadsheet,
  Eye,
  Printer,
  Trash2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { ModulePayrollTab } from "@/components/payroll/ModulePayrollTab";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"];

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "products", label: "Products", icon: Package },
  { id: "projects", label: "Projects", icon: Briefcase },
  { id: "customers", label: "Customers", icon: UserCheck },
  { id: "sales", label: "Sales", icon: ShoppingCart },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "invoices", label: "Invoices", icon: FileText },
  { id: "certificates", label: "Certificates", icon: Award },
  { id: "documents", label: "Documents", icon: Files },
  { id: "payroll", label: "Payroll", icon: Wallet },
  { id: "reports", label: "Reports", icon: PieChart },
  { id: "kanban", label: "Kanban", icon: KanbanSquare },
];

// ---------- Enums & Constants ----------
const PRODUCT_CATEGORIES = [
  { value: "website", label: "Website" },
  { value: "web_application", label: "Web Application" },
  { value: "android_application", label: "Android Application" },
  { value: "ios_application", label: "iOS Application" },
  { value: "desktop_software", label: "Desktop Software" },
  { value: "erp_system", label: "ERP System" },
  { value: "pos_system", label: "POS System" },
  { value: "crm_system", label: "CRM System" },
  { value: "ecommerce_platform", label: "E-commerce Platform" },
  { value: "saas_platform", label: "SaaS Platform" },
  { value: "api_service", label: "API Service" },
  { value: "custom_software", label: "Custom Software" },
  { value: "other", label: "Other" },
];

const PROJECT_STATUS_OPTIONS = [
  { value: "draft", label: "Draft", color: "secondary" },
  { value: "pending_approval", label: "Pending Approval", color: "warning" },
  { value: "approved", label: "Approved", color: "info" },
  { value: "in_progress", label: "In Progress", color: "primary" },
  { value: "testing", label: "Testing", color: "warning" },
  { value: "uat", label: "UAT", color: "warning" },
  { value: "completed", label: "Completed", color: "success" },
  { value: "delivered", label: "Delivered", color: "success" },
  { value: "rejected", label: "Rejected", color: "destructive" },
  { value: "cancelled", label: "Cancelled", color: "secondary" },
] as const;

const SALE_STATUS_OPTIONS = [
  { value: "draft", label: "Draft", color: "secondary" },
  { value: "pending_approval", label: "Pending Approval", color: "warning" },
  { value: "approved", label: "Approved", color: "info" },
  { value: "rejected", label: "Rejected", color: "destructive" },
  { value: "payment_pending", label: "Payment Pending", color: "warning" },
  { value: "partially_paid", label: "Partially Paid", color: "warning" },
  { value: "fully_paid", label: "Fully Paid", color: "success" },
  { value: "completed", label: "Completed", color: "success" },
] as const;

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "mobile_banking", label: "Mobile Banking" },
  { value: "cheque", label: "Cheque" },
  { value: "online_payment", label: "Online Payment" },
];

const DOC_TYPES = [
  { value: "proposal", label: "Proposal" },
  { value: "quotation", label: "Quotation" },
  { value: "contract", label: "Contract" },
  { value: "agreement", label: "Agreement" },
  { value: "requirements", label: "Requirements" },
  { value: "design", label: "Design" },
  { value: "screenshot", label: "Screenshot" },
  { value: "apk", label: "APK" },
  { value: "executable", label: "Executable" },
  { value: "zip", label: "Archive (ZIP)" },
  { value: "source_code", label: "Source Code" },
  { value: "invoice", label: "Invoice" },
  { value: "certificate", label: "Certificate" },
  { value: "other", label: "Other" },
];

const REPORT_TYPES = [
  { value: "sales_summary", label: "Sales Summary" },
  { value: "project_progress", label: "Project Progress" },
  { value: "payment_collection", label: "Payment Collection" },
  { value: "customer_analysis", label: "Customer Analysis" },
  { value: "product_performance", label: "Product Performance" },
  { value: "revenue_report", label: "Revenue Report" },
  { value: "outstanding_payments", label: "Outstanding Payments" },
  { value: "developer_performance", label: "Developer Performance" },
];

const KANBAN_COLUMNS = [
  { id: "pending_approval", label: "Pending Approval", color: "bg-slate-500" },
  { id: "approved", label: "Approved", color: "bg-blue-500" },
  { id: "in_progress", label: "In Progress", color: "bg-amber-500" },
  { id: "testing", label: "Testing", color: "bg-pink-500" },
  { id: "uat", label: "UAT", color: "bg-purple-500" },
  { id: "completed", label: "Completed", color: "bg-green-500" },
  { id: "delivered", label: "Delivered", color: "bg-emerald-600" },
];

const VALID_NEXT: Record<string, string | null> = {
  pending_approval: "approved",
  approved: "in_progress",
  in_progress: "testing",
  testing: "uat",
  uat: "completed",
  completed: "delivered",
  delivered: null,
};

const VALID_PREV: Record<string, string | null> = {
  pending_approval: null,
  approved: null,
  in_progress: null,
  testing: "in_progress",
  uat: "testing",
  completed: "uat",
  delivered: "completed",
};

const VALID_TAB_IDS = new Set(TABS.map((tab) => tab.id));

function getInitialTab() {
  const hash = window.location.hash.replace(/^#/, "");
  return VALID_TAB_IDS.has(hash) ? hash : "dashboard";
}

function formatProjectDate(value: unknown) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function getProjectProgress(status: string) {
  const order = ["pending_approval", "approved", "in_progress", "testing", "uat", "completed", "delivered"];
  const index = order.indexOf(status);
  if (index === -1) return 0;
  return Math.round(((index + 1) / order.length) * 100);
}

// ==================== DASHBOARD TAB ====================
function DashboardTab({ isAdmin }: { isAdmin: boolean }) {
  const { data: devStats, isLoading: devLoading } = trpc.softwareDashboard.developer.useQuery();
  const { data: adminStats, isLoading: adminLoading } = trpc.softwareDashboard.admin.useQuery(undefined, {
    enabled: isAdmin,
  });

  const kpiStats = devStats;
  const isLoading = devLoading || (isAdmin && adminLoading);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <OniLoader size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  const monthlySalesData = devStats?.monthlySales?.map((item: any) => ({
    month: item.month,
    revenue: Number(item.total || 0),
    sales: item.count,
  })) || [];

  const projectStatusData = devStats?.projectStatus?.map((item: any) => ({
    name: item.status.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
    value: item.count,
  })) || [];

  const paymentStatusData = devStats?.paymentStatus?.map((item: any) => ({
    name: item.status.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
    value: item.count,
  })) || [];

  return (
    <SoftwareTabPanel className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Total Products" value={kpiStats?.totalProducts || 0} icon={Package} />
        <KPICard title="Active Projects" value={kpiStats?.activeProjects || 0} icon={Briefcase} />
        <KPICard title="Pending Sales" value={kpiStats?.pendingSales || 0} icon={ShoppingCart} />
        <KPICard title="Total Revenue" value={`Nu.${Number(kpiStats?.totalRevenue || 0).toLocaleString()}`} icon={DollarSign} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Pending Projects" value={kpiStats?.pendingProjects || 0} icon={Clock} color="bg-amber-500" />
        <KPICard title="Completed Projects" value={kpiStats?.completedProjects || 0} icon={CheckCircle} color="bg-emerald-500" />
        <KPICard title="Approved Sales" value={kpiStats?.approvedSales || 0} icon={TrendingUp} color="bg-blue-500" />
        <KPICard title="Outstanding Payments" value={`Nu.${Number(kpiStats?.outstandingPayments || 0).toLocaleString()}`} icon={CreditCard} color="bg-red-500" />
      </div>
      {isAdmin && adminStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Total Developers" value={adminStats.totalDevelopers || 0} icon={Package} color="bg-blue-500" />
          <KPICard title="Pending Product Approvals" value={adminStats.pendingProductApprovals || 0} icon={Package} color="bg-amber-500" />
          <KPICard title="Pending Project Approvals" value={adminStats.pendingProjectApprovals || 0} icon={Briefcase} color="bg-amber-500" />
          <KPICard title="Pending Sales Approvals" value={adminStats.pendingSalesApprovals || 0} icon={ShoppingCart} color="bg-amber-500" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AppleCard hover={false} className="p-4 lg:col-span-2">
          <h3 className="mb-4 text-lg font-semibold">Monthly Sales</h3>
          {monthlySalesData.length > 0 ? (
            <div className="software-dev-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySalesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No sales data" description="Sales data will appear here once transactions are recorded." />
          )}
        </AppleCard>
        <AppleCard hover={false} className="p-4">
          <h3 className="mb-4 text-lg font-semibold">Project Status</h3>
          {projectStatusData.length > 0 ? (
            <div className="software-dev-chart">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie data={projectStatusData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                  {projectStatusData.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No project data" description="Project status distribution will appear here." />
          )}
        </AppleCard>
      </div>
      <AppleCard hover={false} className="p-4">
        <h3 className="mb-4 text-lg font-semibold">Payment Status Distribution</h3>
        {paymentStatusData.length > 0 ? (
          <div className="software-dev-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={paymentStatusData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} />
              <RechartsTooltip />
              <Bar dataKey="value" fill="#82CA9D" name="Count" />
            </BarChart>
          </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState title="No payment data" description="Payment status will appear here once payments are recorded." />
        )}
      </AppleCard>
    </SoftwareTabPanel>
  );
}
// ==================== PRODUCTS TAB ====================
function ProductsTab({ isAdmin, canManage }: { isAdmin: boolean; canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [viewProduct, setViewProduct] = useState<any>(null);
  const [approvalProduct, setApprovalProduct] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    category: "",
    shortDescription: "",
    detailedDescription: "",
    price: "",
    features: "",
    technologiesUsed: "",
    estimatedDuration: "",
    version: "",
    demoUrl: "",
    documentationUrl: "",
    warrantyPeriod: "",
    maintenancePeriod: "",
  });
  const [previewOpen, setPreviewOpen] = useState(false);

  const quillModules = useMemo(() => ({
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ indent: "-1" }, { indent: "+1" }],
      [{ color: [] }, { background: [] }],
      [{ align: [] }],
      ["link", "image", "code-block"],
      ["clean"],
    ],
  }), []);

  const quillFormats = [
    "header", "bold", "italic", "underline", "strike",
    "list", "bullet", "indent", "color", "background",
    "align", "link", "image", "code-block",
  ];

  const { data, isLoading, refetch } = trpc.softwareProduct.list.useQuery({
    search: search || undefined,
    category: categoryFilter === "all" ? undefined : categoryFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    limit: 10,
  });
  const createMutation = trpc.softwareProduct.create.useMutation({
    onSuccess: () => {
      toast.success("Product created");
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.softwareProduct.update.useMutation({
    onSuccess: () => {
      toast.success("Product updated");
      setIsEditOpen(false);
      setEditProduct(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const submitMutation = trpc.softwareProduct.submitForApproval.useMutation({
    onSuccess: () => { toast.success("Submitted for approval"); refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.softwareProduct.delete.useMutation({
    onSuccess: () => { toast.success("Deleted"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter]);

  const resetForm = () => {
    setForm({
      name: "",
      category: "",
      shortDescription: "",
      detailedDescription: "",
      price: "",
      features: "",
      technologiesUsed: "",
      estimatedDuration: "",
      version: "",
      demoUrl: "",
      documentationUrl: "",
      warrantyPeriod: "",
      maintenancePeriod: "",
    });
    setPreviewOpen(false);
  };

  const openEdit = (product: any) => {
    setEditProduct(product);
    setForm({
      name: product.name || "",
      category: product.category || "",
      shortDescription: product.shortDescription || "",
      detailedDescription: product.detailedDescription || "",
      price: product.price || "",
      features: product.features && Array.isArray(product.features) ? product.features.join(", ") : "",
      technologiesUsed: product.technologiesUsed || "",
      estimatedDuration: product.estimatedDuration || "",
      version: product.version || "",
      demoUrl: product.demoUrl || "",
      documentationUrl: product.documentationUrl || "",
      warrantyPeriod: product.warrantyPeriod ? String(product.warrantyPeriod) : "",
      maintenancePeriod: product.maintenancePeriod ? String(product.maintenancePeriod) : "",
    });
    setIsEditOpen(true);
  };

  const handleCreate = () => {
    createMutation.mutate({
      name: form.name,
      category: form.category as any,
      shortDescription: form.shortDescription || undefined,
      detailedDescription: form.detailedDescription || undefined,
      price: form.price || undefined,
      features: form.features ? form.features.split(",").map((f) => f.trim()).filter(Boolean) : undefined,
      technologiesUsed: form.technologiesUsed || undefined,
      estimatedDuration: form.estimatedDuration || undefined,
      version: form.version || undefined,
      demoUrl: form.demoUrl || undefined,
      documentationUrl: form.documentationUrl || undefined,
      warrantyPeriod: form.warrantyPeriod ? Number(form.warrantyPeriod) : undefined,
      maintenancePeriod: form.maintenancePeriod ? Number(form.maintenancePeriod) : undefined,
    });
  };

  const handleUpdate = () => {
    if (!editProduct) return;
    updateMutation.mutate({
      id: editProduct.id,
      name: form.name,
      category: form.category as any,
      shortDescription: form.shortDescription || undefined,
      detailedDescription: form.detailedDescription || undefined,
      price: form.price || undefined,
      features: form.features ? form.features.split(",").map((f) => f.trim()).filter(Boolean) : undefined,
      technologiesUsed: form.technologiesUsed || undefined,
      estimatedDuration: form.estimatedDuration || undefined,
      version: form.version || undefined,
      demoUrl: form.demoUrl || undefined,
      documentationUrl: form.documentationUrl || undefined,
      warrantyPeriod: form.warrantyPeriod ? Number(form.warrantyPeriod) : undefined,
      maintenancePeriod: form.maintenancePeriod ? Number(form.maintenancePeriod) : undefined,
    });
  };

  const buildFormDialog = (isEdit: boolean) => (
    <DialogContent className={softwareFormDialogClass}>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit Product" : "Create Product"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Product Name *</Label>
            <Input placeholder="e.g. Real Estate CRM" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Category *</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{PRODUCT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Base Price (Nu.)</Label>
            <Input placeholder="0.00" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Version</Label>
            <Input placeholder="e.g. 1.0.0" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Short Description</Label>
          <Input placeholder="Brief one-line description..." value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} />
        </div>

        <div className="space-y-2">
          <Label>Features (comma separated)</Label>
          <Input placeholder="e.g. Multi-tenant, API, Dashboard" value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Technologies Used</Label>
            <Input placeholder="e.g. React, Node.js, PostgreSQL" value={form.technologiesUsed} onChange={(e) => setForm({ ...form, technologiesUsed: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Estimated Duration</Label>
            <Input placeholder="e.g. 3 months" value={form.estimatedDuration} onChange={(e) => setForm({ ...form, estimatedDuration: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Warranty Period (months)</Label>
            <Input type="number" placeholder="0" value={form.warrantyPeriod} onChange={(e) => setForm({ ...form, warrantyPeriod: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Maintenance Period (months)</Label>
            <Input type="number" placeholder="0" value={form.maintenancePeriod} onChange={(e) => setForm({ ...form, maintenancePeriod: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Demo URL</Label>
            <Input placeholder="https://..." value={form.demoUrl} onChange={(e) => setForm({ ...form, demoUrl: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Documentation URL</Label>
            <Input placeholder="https://..." value={form.documentationUrl} onChange={(e) => setForm({ ...form, documentationUrl: e.target.value })} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Detailed Description</Label>
          <div className="quill-wrapper">
            <ReactQuill
              theme="snow"
              value={form.detailedDescription}
              onChange={(value) => setForm({ ...form, detailedDescription: value })}
              modules={quillModules}
              formats={quillFormats}
              placeholder="Describe the product features, benefits, and specifications..."
              className="bg-background rounded-lg"
            />
          </div>
        </div>

        {form.detailedDescription && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Preview</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewOpen(!previewOpen)}>
                {previewOpen ? "Hide" : "Show"} Preview
              </Button>
            </div>
            {previewOpen && (
              <AppleCard hover={false} className="max-h-48 overflow-y-auto p-4">
                <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: form.detailedDescription }} />
              </AppleCard>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-10" onClick={() => { isEdit ? setIsEditOpen(false) : setIsCreateOpen(false); }}>Cancel</Button>
          <Button
            type="button"
            className="min-h-10"
            onClick={isEdit ? handleUpdate : handleCreate}
            disabled={(isEdit ? updateMutation.isPending : createMutation.isPending) || !form.name || !form.category}
          >
            {isEdit ? (updateMutation.isPending ? "Saving..." : "Save Changes") : (createMutation.isPending ? "Creating..." : "Create Product")}
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><OniLoader size="lg" text="Loading products..." /></div>;

  return (
    <div className="space-y-4">
      <TabToolbar>
        <TabSearchWrap>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </TabSearchWrap>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className={tabSelectClass}>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {PRODUCT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={tabSelectClass}>
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_approval">Pending Approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        {canManage && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className={tabActionClass}><Plus className="h-4 w-4 mr-1" /> New Product</Button>
            </DialogTrigger>
            {buildFormDialog(false)}
          </Dialog>
        )}
      </TabToolbar>

      {/* Product Cards */}
      <div className="grid gap-3">
        {data?.items?.map((product: any) => (
          <EntityCard
            key={product.id}
            entity={product}
            type="product"
            isAdmin={isAdmin}
            canManage={canManage}
            onView={() => setViewProduct(product)}
            onEdit={() => openEdit(product)}
            onSubmit={() => submitMutation.mutate({ id: product.id })}
            onApprove={() => setApprovalProduct(product)}
            onDelete={() => confirmEntityDelete(product, "product") && deleteMutation.mutate({ id: product.id })}
          />
        ))}
        {(!data?.items || data.items.length === 0) && (
          <EmptyState
            title="No products"
            description={canManage ? "Create your first software product." : "No products to review yet."}
          />
        )}
      </div>

      {/* Pagination */}
      {data && <SoftwarePagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}

      {/* View Dialog */}
      <DetailViewDialog
        open={!!viewProduct}
        onClose={() => setViewProduct(null)}
        title={viewProduct?.name || "Product Details"}
        entity={viewProduct}
        type="product"
      />

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        {buildFormDialog(true)}
      </Dialog>

      {/* Approval Dialog */}
      <ApprovalDialog
        open={!!approvalProduct}
        onClose={() => setApprovalProduct(null)}
        entityType="product"
        entity={approvalProduct}
        onApproved={() => refetch()}
      />
    </div>
  );
}

// ==================== PROJECTS TAB ====================
function ProjectsTab({ isAdmin, canManage }: { isAdmin: boolean; canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editProject, setEditProject] = useState<any>(null);
  const [viewProject, setViewProject] = useState<any>(null);
  const [approvalProject, setApprovalProject] = useState<any>(null);
  const [form, setForm] = useState({
    customerId: "",
    productId: "",
    name: "",
    description: "",
    requirements: "",
    startDate: "",
    endDate: "",
    estimatedBudget: "",
    assignedDeveloperId: "unassigned",
    priority: "medium",
  });

  const { data, isLoading, refetch } = trpc.softwareProject.list.useQuery({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    limit: 10,
  });
  const { data: customers } = trpc.softwareCustomer.list.useQuery({ limit: 100 });
  const { data: sellableProducts } = trpc.softwareProduct.getSellable.useQuery();
  const { data: developers } = trpc.softwareDashboard.developerList.useQuery();

  const createMutation = trpc.softwareProject.create.useMutation({
    onSuccess: () => { toast.success("Project created"); setIsCreateOpen(false); resetForm(); refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.softwareProject.update.useMutation({
    onSuccess: () => { toast.success("Project updated"); setIsEditOpen(false); setEditProject(null); refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const submitMutation = trpc.softwareProject.submitForApproval.useMutation({
    onSuccess: () => { toast.success("Submitted for approval"); refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.softwareProject.delete.useMutation({
    onSuccess: () => { toast.success("Deleted"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const resetForm = () => {
    setForm({
      customerId: "",
      productId: "",
      name: "",
      description: "",
      requirements: "",
      startDate: "",
      endDate: "",
      estimatedBudget: "",
      assignedDeveloperId: "unassigned",
      priority: "medium",
    });
  };

  const openEdit = (project: any) => {
    setEditProject(project);
    setForm({
      customerId: project.customerId ? String(project.customerId) : "",
      productId: project.productId ? String(project.productId) : "",
      name: project.name || "",
      description: project.description || "",
      requirements: project.requirements || "",
      startDate: project.startDate ? new Date(project.startDate).toISOString().split("T")[0] : "",
      endDate: project.endDate ? new Date(project.endDate).toISOString().split("T")[0] : "",
      estimatedBudget: project.estimatedBudget ? String(project.estimatedBudget) : "",
      assignedDeveloperId: project.assignedDeveloperId ? String(project.assignedDeveloperId) : "unassigned",
      priority: project.priority || "medium",
    });
    setIsEditOpen(true);
  };

  const handleCreate = () => {
    createMutation.mutate({
      customerId: Number(form.customerId),
      productId: Number(form.productId),
      name: form.name,
      description: form.description || undefined,
      requirements: form.requirements || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      estimatedBudget: form.estimatedBudget || undefined,
      assignedDeveloperId:
        form.assignedDeveloperId && form.assignedDeveloperId !== "unassigned"
          ? Number(form.assignedDeveloperId)
          : undefined,
      priority: form.priority as "low" | "medium" | "high" | "urgent",
    });
  };

  const handleUpdate = () => {
    if (!editProject) return;
    updateMutation.mutate({
      id: editProject.id,
      name: form.name,
      description: form.description || undefined,
      requirements: form.requirements || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      estimatedBudget: form.estimatedBudget || undefined,
      assignedDeveloperId:
        form.assignedDeveloperId && form.assignedDeveloperId !== "unassigned"
          ? Number(form.assignedDeveloperId)
          : undefined,
      priority: form.priority as "low" | "medium" | "high" | "urgent",
    });
  };

  const buildFormDialog = (isEdit: boolean) => (
    <DialogContent className={softwareFormDialogClass}>
      <DialogHeader><DialogTitle>{isEdit ? "Edit Project" : "Create Project"}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Project Name *</Label>
            <Input placeholder="e.g. CRM Implementation" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Customer *</Label>
            <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers?.items?.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {getCustomerLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Product *</Label>
            <Select value={form.productId} onValueChange={(v) => setForm({ ...form, productId: v })}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {(sellableProducts ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Estimated Budget (Nu.)</Label>
            <Input type="number" placeholder="0.00" value={form.estimatedBudget} onChange={(e) => setForm({ ...form, estimatedBudget: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Assigned Developer</Label>
            <Select value={form.assignedDeveloperId} onValueChange={(v) => setForm({ ...form, assignedDeveloperId: v })}>
              <SelectTrigger><SelectValue placeholder="Select developer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {developers?.map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.fullName || d.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea placeholder="Project overview..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Requirements</Label>
          <Textarea placeholder="Detailed requirements..." value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => isEdit ? setIsEditOpen(false) : setIsCreateOpen(false)}>Cancel</Button>
          <Button onClick={isEdit ? handleUpdate : handleCreate} disabled={(isEdit ? updateMutation.isPending : createMutation.isPending) || !form.name || !form.customerId || !form.productId}>
            {isEdit ? (updateMutation.isPending ? "Saving..." : "Save Changes") : (createMutation.isPending ? "Creating..." : "Create Project")}
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><OniLoader size="lg" text="Loading projects..." /></div>;

  return (
    <div className="space-y-4">
      <TabToolbar>
        <TabSearchWrap>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </TabSearchWrap>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={tabSelectClass}><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {PROJECT_STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {canManage && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild><Button className={tabActionClass}><Plus className="h-4 w-4 mr-1" /> New Project</Button></DialogTrigger>
            {buildFormDialog(false)}
          </Dialog>
        )}
      </TabToolbar>
      <div className="grid gap-3">
        {data?.items?.map((project: any) => (
          <EntityCard key={project.id} entity={project} type="project" isAdmin={isAdmin} canManage={canManage}
            onView={() => setViewProject(project)}
            onEdit={() => openEdit(project)}
            onSubmit={() => submitMutation.mutate({ id: project.id })}
            onApprove={() => setApprovalProject(project)}
            onDelete={() => confirmEntityDelete(project, "project") && deleteMutation.mutate({ id: project.id })}
          />
        ))}
        {(!data?.items || data.items.length === 0) && (
          <EmptyState title="No projects" description={canManage ? "Create your first project." : "No projects to review yet."} />
        )}
      </div>
      {data && <SoftwarePagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}
      <DetailViewDialog open={!!viewProject} onClose={() => setViewProject(null)} title={viewProject?.name || "Project Details"} entity={viewProject} type="project" />
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>{buildFormDialog(true)}</Dialog>
      <ApprovalDialog open={!!approvalProject} onClose={() => setApprovalProject(null)} entityType="project" entity={approvalProject} onApproved={() => refetch()} />
    </div>
  );
}

// ==================== CUSTOMERS TAB ====================
function CustomersTab({ isAdmin, canManage }: { isAdmin: boolean; canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [viewCustomer, setViewCustomer] = useState<any>(null);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", address: "", companyName: "", notes: "" });

  const { data, isLoading, refetch } = trpc.softwareCustomer.list.useQuery({ search: search || undefined, page, limit: 10 });
  const createMutation = trpc.softwareCustomer.create.useMutation({ onSuccess: () => { toast.success("Customer created"); setIsCreateOpen(false); setForm({ fullName: "", email: "", phone: "", address: "", companyName: "", notes: "" }); refetch(); }, onError: (err) => toast.error(err.message) });
  const updateMutation = trpc.softwareCustomer.update.useMutation({ onSuccess: () => { toast.success("Customer updated"); setIsEditOpen(false); setEditCustomer(null); refetch(); }, onError: (err) => toast.error(err.message) });
  const deleteMutation = trpc.softwareCustomer.delete.useMutation({ onSuccess: () => { toast.success("Deleted"); refetch(); }, onError: (err) => toast.error(err.message) });

  const openEdit = (customer: any) => {
    setEditCustomer(customer);
    setForm({ fullName: customer.fullName || "", email: customer.email || "", phone: customer.phone || "", address: customer.address || "", companyName: customer.companyName || "", notes: customer.notes || "" });
    setIsEditOpen(true);
  };

  const buildFormDialog = (isEdit: boolean) => (
    <DialogContent className={softwareDialogSmClass}>
      <DialogHeader><DialogTitle>{isEdit ? "Edit Customer" : "New Customer"}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2"><Label>Name *</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-2"><Label>Phone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <div className="space-y-2"><Label>Company</Label><Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></div>
        <div className="space-y-2"><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => isEdit ? setIsEditOpen(false) : setIsCreateOpen(false)}>Cancel</Button>
          <Button onClick={() => isEdit ? updateMutation.mutate({ id: editCustomer.id, ...form }) : createMutation.mutate(form)} disabled={!form.fullName || !form.email || !form.phone}>
            {isEdit ? (updateMutation.isPending ? "Saving..." : "Save") : (createMutation.isPending ? "Creating..." : "Create")}
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><OniLoader size="lg" text="Loading customers..." /></div>;

  return (
    <div className="space-y-4">
      <TabToolbar>
        <TabSearchWrap>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search customers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </TabSearchWrap>
        {canManage && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild><Button className={tabActionClass}><Plus className="h-4 w-4 mr-1" /> New Customer</Button></DialogTrigger>
            {buildFormDialog(false)}
          </Dialog>
        )}
      </TabToolbar>
      <div className="grid gap-3">
        {data?.items?.map((customer: any) => (
          <EntityCard key={customer.id} entity={customer} type="customer" isAdmin={isAdmin} canManage={canManage}
            onView={() => setViewCustomer(customer)}
            onEdit={() => openEdit(customer)}
            onDelete={() => confirmEntityDelete(customer, "customer") && deleteMutation.mutate({ id: customer.id })}
          />
        ))}
        {(!data?.items || data.items.length === 0) && (
          <EmptyState title="No customers" description={canManage ? "Add your first customer." : "No customers on record yet."} />
        )}
      </div>
      {data && <SoftwarePagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}
      <DetailViewDialog open={!!viewCustomer} onClose={() => setViewCustomer(null)} title={viewCustomer?.fullName || "Customer Details"} entity={viewCustomer} type="customer" />
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>{buildFormDialog(true)}</Dialog>
    </div>
  );
}

// ==================== SALES TAB ====================
function SalesTab({ isAdmin, canManage }: { isAdmin: boolean; canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewSale, setViewSale] = useState<any>(null);
  const [approvalSale, setApprovalSale] = useState<any>(null);
  const [form, setForm] = useState({
    customerId: "",
    productId: "",
    projectId: "none",
    quantity: "1",
    basePrice: "",
    additionalFeaturesCost: "",
    discountAmount: "",
    taxAmount: "",
    grandTotal: "",
    paymentTerms: "",
    deliveryDate: "",
    notes: "",
  });

  const { data, isLoading, refetch } = trpc.softwareSale.list.useQuery({ search: search || undefined, status: statusFilter === "all" ? undefined : statusFilter, page, limit: 10 });
  const { data: customers } = trpc.softwareCustomer.list.useQuery({ limit: 100 });
  const { data: products } = trpc.softwareProduct.getSellable.useQuery({});
  const { data: projects } = trpc.softwareProject.list.useQuery({ limit: 100 });

  const createMutation = trpc.softwareSale.create.useMutation({ onSuccess: () => { toast.success("Sale created"); setIsCreateOpen(false); resetForm(); refetch(); }, onError: (err: { message: string }) => toast.error(err.message) });
  const submitMutation = trpc.softwareSale.submitForApproval.useMutation({ onSuccess: () => { toast.success("Submitted for approval"); refetch(); }, onError: (err: { message: string }) => toast.error(err.message) });
  const deleteMutation = trpc.softwareSale.delete.useMutation({ onSuccess: () => { toast.success("Deleted"); refetch(); }, onError: (err: { message: string }) => toast.error(err.message) });

  const resetForm = () => setForm({ customerId: "", productId: "", projectId: "none", quantity: "1", basePrice: "", additionalFeaturesCost: "", discountAmount: "", taxAmount: "", grandTotal: "", paymentTerms: "", deliveryDate: "", notes: "" });

  useEffect(() => {
    const base = parseFloat(form.basePrice) || 0;
    const addons = parseFloat(form.additionalFeaturesCost) || 0;
    const discount = parseFloat(form.discountAmount) || 0;
    const tax = parseFloat(form.taxAmount) || 0;
    const qty = parseFloat(form.quantity) || 1;
    const total = Math.max(0, (base + addons) * qty - discount + tax);
    setForm((prev) => (prev.grandTotal === total.toFixed(2) ? prev : { ...prev, grandTotal: total.toFixed(2) }));
  }, [form.basePrice, form.additionalFeaturesCost, form.discountAmount, form.taxAmount, form.quantity]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const buildFormDialog = () => (
    <DialogContent className={softwareFormDialogClass}>
      <DialogHeader><DialogTitle>Create Sale</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Customer *</Label>
            <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>{customers?.items?.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{getCustomerLabel(c)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Product *</Label>
            <Select value={form.productId} onValueChange={(v) => setForm({ ...form, productId: v })}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>{products?.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Project (optional)</Label>
          <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
            <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
            <SelectContent><SelectItem value="none">None</SelectItem>{projects?.items?.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2"><Label>Qty</Label><Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
          <div className="space-y-2"><Label>Base Price</Label><Input type="number" placeholder="0.00" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} /></div>
          <div className="space-y-2"><Label>Add-on Cost</Label><Input type="number" placeholder="0.00" value={form.additionalFeaturesCost} onChange={(e) => setForm({ ...form, additionalFeaturesCost: e.target.value })} /></div>
          <div className="space-y-2"><Label>Discount</Label><Input type="number" placeholder="0.00" value={form.discountAmount} onChange={(e) => setForm({ ...form, discountAmount: e.target.value })} /></div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-1"><Label>Tax</Label><Input type="number" placeholder="0.00" value={form.taxAmount} onChange={(e) => setForm({ ...form, taxAmount: e.target.value })} /></div>
        </div>
        <div className="space-y-2">
          <Label>Total Amount (auto-calculated)</Label>
          <Input type="number" placeholder="0.00" value={form.grandTotal} onChange={(e) => setForm({ ...form, grandTotal: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Payment Terms</Label><Input placeholder="e.g. 50% advance" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} /></div>
          <div className="space-y-2"><Label>Delivery Date</Label><Input type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} /></div>
        </div>
        <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
          <Button onClick={() => {
            createMutation.mutate({
              customerId: Number(form.customerId),
              productId: Number(form.productId),
              projectId: form.projectId && form.projectId !== "none" ? Number(form.projectId) : undefined,
              basePrice: form.basePrice || "0",
              additionalFeaturesCost: form.additionalFeaturesCost || undefined,
              discountAmount: form.discountAmount || undefined,
              taxAmount: form.taxAmount || undefined,
              grandTotal: form.grandTotal || "0",
            });
          }} disabled={!form.customerId || !form.productId || !form.basePrice || !form.grandTotal}>
            {createMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><OniLoader size="lg" text="Loading sales..." /></div>;

  return (
    <div className="space-y-4">
      <TabToolbar>
        <TabSearchWrap>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search sales..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </TabSearchWrap>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={tabSelectClass}><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {SALE_STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {canManage && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild><Button className={tabActionClass}><Plus className="h-4 w-4 mr-1" /> New Sale</Button></DialogTrigger>
            {buildFormDialog()}
          </Dialog>
        )}
      </TabToolbar>
      <div className="grid gap-3">
        {data?.items?.map((sale: any) => (
          <EntityCard key={sale.id} entity={sale} type="sale" isAdmin={isAdmin} canManage={canManage}
            onView={() => setViewSale(sale)}
            onSubmit={() => submitMutation.mutate({ id: sale.id })}
            onApprove={() => setApprovalSale(sale)}
            onDelete={() => confirmEntityDelete(sale, "sale") && deleteMutation.mutate({ id: sale.id })}
          />
        ))}
        {(!data?.items || data.items.length === 0) && (
          <EmptyState title="No sales" description={canManage ? "Create your first sale." : "No sales to review yet."} />
        )}
      </div>
      {data && <SoftwarePagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}
      <DetailViewDialog open={!!viewSale} onClose={() => setViewSale(null)} title={viewSale?.saleNumber || `Sale #${viewSale?.id || ""}`} entity={viewSale} type="sale" />
      <ApprovalDialog open={!!approvalSale} onClose={() => setApprovalSale(null)} entityType="sale" entity={approvalSale} onApproved={() => refetch()} />
    </div>
  );
}

// ==================== PAYMENTS TAB ====================
function PaymentsTab({ canManage }: { canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewPayment, setViewPayment] = useState<any>(null);
  const [form, setForm] = useState({
    saleId: "",
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "bank_transfer",
    referenceNumber: "",
    notes: "",
  });

  const { data, isLoading, refetch } = trpc.softwarePayment.list.useQuery({ page, limit: 50 });
  const { data: sales } = trpc.softwareSale.list.useQuery({ limit: 100 });

  const createMutation = trpc.softwarePayment.create.useMutation({
    onSuccess: () => {
      toast.success("Payment recorded");
      setIsCreateOpen(false);
      setForm({
        saleId: "",
        amount: "",
        paymentDate: new Date().toISOString().split("T")[0],
        paymentMethod: "bank_transfer",
        referenceNumber: "",
        notes: "",
      });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (p: any) =>
        String(p.paymentNumber || "").toLowerCase().includes(q) ||
        String(p.referenceNumber || "").toLowerCase().includes(q) ||
        String(p.amount || "").includes(q)
    );
  }, [data?.items, search]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * 10;
    return filteredItems.slice(start, start + 10);
  }, [filteredItems, page]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / 10));

  const buildFormDialog = () => (
    <DialogContent className={softwareDialogSmClass}>
      <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Sale *</Label>
          <Select value={form.saleId} onValueChange={(v) => setForm({ ...form, saleId: v })}>
            <SelectTrigger><SelectValue placeholder="Select sale" /></SelectTrigger>
            <SelectContent>
              {sales?.items?.map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.saleNumber || `Sale #${s.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Amount (Nu.) *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div className="space-y-2"><Label>Payment Date *</Label><Input type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Method *</Label>
            <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
              <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Reference #</Label><Input value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} /></div>
        </div>
        <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
          <Button
            onClick={() =>
              createMutation.mutate({
                saleId: Number(form.saleId),
                amount: form.amount,
                paymentDate: form.paymentDate,
                paymentMethod: form.paymentMethod as "cash" | "bank_transfer" | "mobile_banking" | "cheque" | "online_payment",
                referenceNumber: form.referenceNumber || undefined,
                notes: form.notes || undefined,
              })
            }
            disabled={!form.saleId || !form.amount || !form.paymentDate || !form.paymentMethod || createMutation.isPending}
          >
            {createMutation.isPending ? "Recording..." : "Record"}
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><OniLoader size="lg" text="Loading payments..." /></div>;

  return (
    <div className="space-y-4">
      <TabToolbar>
        <TabSearchWrap>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search payments..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </TabSearchWrap>
        {canManage && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild><Button className={tabActionClass}><Plus className="h-4 w-4 mr-1" /> Record Payment</Button></DialogTrigger>
            {buildFormDialog()}
          </Dialog>
        )}
      </TabToolbar>
      <div className="grid gap-3">
        {pagedItems.map((payment: any) => (
          <EntityCard key={payment.id} entity={payment} type="payment" onView={() => setViewPayment(payment)} />
        ))}
        {pagedItems.length === 0 && (
          <EmptyState title="No payments" description={canManage ? "Record your first payment." : "No payments recorded yet."} />
        )}
      </div>
      <SoftwarePagination page={page} totalPages={totalPages} onPageChange={setPage} />
      <DetailViewDialog open={!!viewPayment} onClose={() => setViewPayment(null)} title={`Payment #${viewPayment?.paymentNumber || viewPayment?.id || ""}`} entity={viewPayment} type="payment" />
    </div>
  );
}

// ==================== CERTIFICATES TAB ====================
function CertificatesTab({ isAdmin }: { isAdmin: boolean }) {
  const utils = trpc.useUtils();
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [viewCert, setViewCert] = useState<any>(null);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    saleId: "",
    certificateType: "project_completion" as "project_completion" | "software_ownership",
    projectId: "",
  });

  const { data, isLoading, refetch } = trpc.softwareCertificate.list.useQuery({
    type: typeFilter === "all" ? undefined : typeFilter,
    page,
    limit: 10,
  });
  const { data: sales } = trpc.softwareSale.list.useQuery({ limit: 200 });
  const eligibleSales = useMemo(
    () =>
      (sales?.items ?? []).filter(
        (s: any) =>
          (s.status === "completed" || s.status === "fully_paid") &&
          parseFloat(s.outstandingBalance || "0") === 0
      ),
    [sales?.items]
  );
  const { data: projects } = trpc.softwareProject.list.useQuery({ limit: 100 });

  const generateMutation = trpc.softwareCertificate.generate.useMutation({
    onSuccess: async (result) => {
      toast.success(`Certificate ${result.certificateNumber} generated`);
      setIsGenerateOpen(false);
      setGenerateForm({ saleId: "", certificateType: "project_completion", projectId: "" });
      await refetch();
      try {
        const cert = await utils.softwareCertificate.getById.fetch({ id: result.id });
        setViewCert(cert);
      } catch {
        // list refetch is enough if detail fetch fails
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleVerify = async () => {
    if (!verifyInput.trim()) return;
    setVerifyLoading(true);
    setVerifyResult(null);
    try {
      const cert = await utils.softwareCertificate.verify.fetch({ verificationNumber: verifyInput.trim() });
      setVerifyResult(cert);
    } catch (err: any) {
      toast.error(err.message || "Invalid verification number");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handlePrintCert = async (cert: any) => {
    try {
      const settings = await utils.settings.getPublicSettings.fetch();
      await printCertificate(cert, settings);
      toast.success("Opening print dialog…");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to print certificate");
    }
  };

  const handleDownloadCert = async (cert: any) => {
    try {
      const settings = await utils.settings.getPublicSettings.fetch();
      await downloadCertificatePdf(cert, settings);
      toast.success("Certificate PDF downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate PDF");
    }
  };

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><OniLoader size="lg" text="Loading certificates..." /></div>;

  return (
    <div className="space-y-4">
      <TabToolbar>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className={cn(tabSelectClass, "sm:w-[200px]")}><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {CERTIFICATE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" className={tabActionClass} onClick={() => { setIsVerifyOpen(true); setVerifyInput(""); setVerifyResult(null); }}>
          Verify Certificate
        </Button>
        {isAdmin && (
          <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
            <DialogTrigger asChild><Button className={tabActionClass}><Plus className="h-4 w-4 mr-1" /> Generate Certificate</Button></DialogTrigger>
            <DialogContent className={softwareDialogSmClass}>
              <DialogHeader><DialogTitle>Generate Certificate</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Completed Sale *</Label>
                  <Select value={generateForm.saleId} onValueChange={(v) => setGenerateForm({ ...generateForm, saleId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select sale" /></SelectTrigger>
                    <SelectContent>
                      {eligibleSales.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.saleNumber || `Sale #${s.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Certificate Type *</Label>
                  <Select
                    value={generateForm.certificateType}
                    onValueChange={(v) => setGenerateForm({ ...generateForm, certificateType: v as "project_completion" | "software_ownership" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CERTIFICATE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Project (optional)</Label>
                  <Select value={generateForm.projectId || "none"} onValueChange={(v) => setGenerateForm({ ...generateForm, projectId: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {projects?.items?.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsGenerateOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() =>
                      generateMutation.mutate({
                        saleId: Number(generateForm.saleId),
                        certificateType: generateForm.certificateType,
                        projectId: generateForm.projectId ? Number(generateForm.projectId) : undefined,
                      })
                    }
                    disabled={!generateForm.saleId || generateMutation.isPending}
                  >
                    {generateMutation.isPending ? "Generating..." : "Generate"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </TabToolbar>
      <div className="grid gap-3">
        {data?.items?.map((cert: any) => (
          <EntityCard
            key={cert.id}
            entity={cert}
            type="certificate"
            onView={() => setViewCert(cert)}
            onPrint={() => handlePrintCert(cert)}
            onDownload={() => handleDownloadCert(cert)}
          />
        ))}
        {(!data?.items || data.items.length === 0) && <EmptyState title="No certificates" description="Certificates are generated from completed sales." />}
      </div>
      {data && <SoftwarePagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}
      <CertificateViewDialog open={!!viewCert} onClose={() => setViewCert(null)} certificate={viewCert} />
      <Dialog open={isVerifyOpen} onOpenChange={setIsVerifyOpen}>
        <DialogContent className={softwareDialogMdClass}>
          <DialogHeader><DialogTitle>Verify Certificate</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Verification Number</Label>
              <Input value={verifyInput} onChange={(e) => setVerifyInput(e.target.value)} placeholder="VER-..." />
            </div>
            {verifyResult && (
              <div className="rounded-lg border p-3 text-sm space-y-2">
                <p><strong>Certificate:</strong> {verifyResult.certificateNumber}</p>
                <p><strong>Verification #:</strong> {verifyResult.verificationNumber}</p>
                <p><strong>Type:</strong> {formatStatusLabel(verifyResult.certificateType)}</p>
                {verifyResult.completionDate && (
                  <p><strong>Issued:</strong> {new Date(verifyResult.completionDate).toLocaleDateString()}</p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => handlePrintCert(verifyResult)}>
                    <Printer className="mr-1 h-3.5 w-3.5" /> Print
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => handleDownloadCert(verifyResult)}>
                    <Download className="mr-1 h-3.5 w-3.5" /> PDF
                  </Button>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsVerifyOpen(false)}>Close</Button>
              <Button onClick={handleVerify} disabled={!verifyInput.trim() || verifyLoading}>
                {verifyLoading ? "Verifying..." : "Verify"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== DOCUMENTS TAB ====================
function DocumentsTab({ canManage }: { canManage: boolean }) {
  const emptyForm = {
    projectId: "none",
    title: "",
    category: "other",
    description: "",
    version: "1.0",
    fileUrl: "",
    fileName: "",
    fileType: "",
    fileSize: 0,
  };
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<any>(null);
  const [viewDoc, setViewDoc] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading, refetch } = trpc.softwareDocument.list.useQuery({
    search: search || undefined,
    category: typeFilter === "all" ? undefined : typeFilter,
    page,
    limit: 10,
  });
  const { data: projects } = trpc.softwareProject.list.useQuery({ limit: 100 });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  const createMutation = trpc.softwareDocument.create.useMutation({
    onSuccess: () => {
      toast.success("Document created");
      setIsCreateOpen(false);
      setForm(emptyForm);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.softwareDocument.update.useMutation({
    onSuccess: () => {
      toast.success("Document updated");
      setIsEditOpen(false);
      setEditDoc(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.softwareDocument.delete.useMutation({
    onSuccess: () => {
      toast.success("Deleted");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = (url: string, meta?: { fileName: string; mimeType: string; fileSize: number }) => {
    if (!meta) return;
    setForm((prev) => ({
      ...prev,
      fileUrl: url,
      fileName: meta.fileName,
      fileType: meta.mimeType,
      fileSize: meta.fileSize,
    }));
  };

  const buildCreatePayload = () => ({
    title: form.title,
    description: form.description || undefined,
    category: form.category,
    fileUrl: form.fileUrl,
    fileName: form.fileName,
    fileType: form.fileType,
    fileSize: form.fileSize,
    version: form.version,
    entityType: form.projectId !== "none" ? "project" : undefined,
    entityId: form.projectId !== "none" ? Number(form.projectId) : undefined,
  });

  const openEdit = (doc: any) => {
    setEditDoc(doc);
    setForm({
      projectId: doc.entityType === "project" && doc.entityId ? String(doc.entityId) : "none",
      title: doc.title || "",
      category: doc.category || "other",
      description: doc.description || "",
      version: doc.version || "1.0",
      fileUrl: doc.fileUrl || "",
      fileName: doc.fileName || "",
      fileType: doc.fileType || "",
      fileSize: doc.fileSize || 0,
    });
    setIsEditOpen(true);
  };

  const buildFormDialog = (isEdit: boolean) => (
    <DialogContent className={softwareFormDialogClass}>
      <DialogHeader><DialogTitle>{isEdit ? "Edit Document" : "Upload Document"}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Project (optional)</Label>
          <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
            <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {projects?.items?.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>{DOC_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Version</Label><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></div>
        <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        {!isEdit && (
          <div className="space-y-2">
            <Label>File *</Label>
            <FileUploader folder="documents" value={form.fileUrl} onChange={handleFileUpload} label="Choose file" />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => (isEdit ? setIsEditOpen(false) : setIsCreateOpen(false))}>Cancel</Button>
          <Button
            onClick={() =>
              isEdit
                ? updateMutation.mutate({ id: editDoc.id, title: form.title, description: form.description || undefined, category: form.category, version: form.version })
                : createMutation.mutate(buildCreatePayload())
            }
            disabled={!form.title || (!isEdit && !form.fileUrl) || createMutation.isPending || updateMutation.isPending}
          >
            {isEdit ? (updateMutation.isPending ? "Saving..." : "Save") : (createMutation.isPending ? "Creating..." : "Create")}
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><OniLoader size="lg" text="Loading documents..." /></div>;

  return (
    <div className="space-y-4">
      <TabToolbar>
        <TabSearchWrap>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search documents..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </TabSearchWrap>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className={tabSelectClass}><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {DOC_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {canManage && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild><Button className={tabActionClass}><Plus className="h-4 w-4 mr-1" /> New Document</Button></DialogTrigger>
            {buildFormDialog(false)}
          </Dialog>
        )}
      </TabToolbar>
      <div className="grid gap-3">
        {data?.items?.map((doc: any) => (
          <EntityCard
            key={doc.id}
            entity={doc}
            type="document"
            canManage={canManage}
            onView={() => setViewDoc(doc)}
            onEdit={() => openEdit(doc)}
            onDownload={doc.fileUrl ? () => window.open(doc.fileUrl, "_blank") : undefined}
            onDelete={() => confirmEntityDelete(doc, "document") && deleteMutation.mutate({ id: doc.id })}
          />
        ))}
        {(!data?.items || data.items.length === 0) && (
          <EmptyState title="No documents" description={canManage ? "Upload your first document." : "No documents uploaded yet."} />
        )}
      </div>
      <SoftwarePagination page={page} totalPages={totalPages} onPageChange={setPage} />
      <DetailViewDialog open={!!viewDoc} onClose={() => setViewDoc(null)} title={viewDoc?.title || "Document Details"} entity={viewDoc} type="document" />
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>{buildFormDialog(true)}</Dialog>
    </div>
  );
}

// ==================== REPORTS TAB ====================
function ReportSummaryView({ reportType, summary }: { reportType: string; summary: any }) {
  if (!summary) return null;

  const statCards: { label: string; value: string | number }[] = [];
  const chartData: { label: string; value: number }[] = [];

  switch (reportType) {
    case "sales_summary":
      statCards.push(
        { label: "Total Sales", value: summary.totalSales ?? 0 },
        { label: "Total Revenue", value: `Nu.${Number(summary.totalRevenue ?? 0).toLocaleString()}` },
        { label: "Average Sale", value: `Nu.${Number(summary.avgSale ?? 0).toLocaleString()}` },
      );
      break;
    case "payment_collection":
      statCards.push(
        { label: "Total Payments", value: summary.totalPayments ?? 0 },
        { label: "Total Collected", value: `Nu.${Number(summary.totalCollected ?? 0).toLocaleString()}` },
      );
      break;
    case "customer_analysis":
      statCards.push({ label: "New Customers", value: summary.totalCustomers ?? 0 });
      break;
    case "outstanding_payments":
      statCards.push(
        { label: "Outstanding Sales", value: summary.count ?? 0 },
        { label: "Outstanding Amount", value: `Nu.${Number(summary.totalOutstanding ?? 0).toLocaleString()}` },
      );
      break;
    case "project_progress":
      (summary.projectsByStatus || []).forEach((row: any) => {
        chartData.push({ label: formatStatusLabel(row.status), value: Number(row.count ?? 0) });
      });
      break;
    case "revenue_report":
      (summary.revenueByMonth || []).forEach((row: any) => {
        chartData.push({ label: row.month, value: Number(row.totalRevenue ?? 0) });
      });
      break;
    case "product_performance":
      (summary.productPerformance || []).forEach((row: any) => {
        chartData.push({ label: row.productName || `Product #${row.productId}`, value: Number(row.totalRevenue ?? 0) });
      });
      break;
    case "developer_performance":
      (summary.developerProjects || []).forEach((row: any) => {
        chartData.push({ label: row.developerId ? `Developer #${row.developerId}` : "Unassigned", value: Number(row.count ?? 0) });
      });
      break;
    default:
      Object.entries(summary).forEach(([key, value]) => {
        if (typeof value === "number" || typeof value === "string") {
          statCards.push({ label: formatStatusLabel(key), value: value as string | number });
        }
      });
  }

  return (
    <>
      {statCards.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {statCards.map((card) => (
            <div key={card.label} className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="text-sm text-muted-foreground">{card.label}</div>
            </div>
          ))}
        </div>
      )}
      {chartData.length > 0 && (
        <div className="w-full overflow-x-auto">
          <ResponsiveContainer width="100%" height={300} minWidth={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" interval={0} angle={-25} textAnchor="end" height={70} />
              <YAxis width={48} />
              <RechartsTooltip />
              <Bar dataKey="value" fill="#8884d8" name="Value" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

function ReportsTab({ canManage, isAdmin }: { canManage: boolean; isAdmin: boolean }) {
  const canGenerate = canManage || isAdmin;
  const defaultRange = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      dateFrom: from.toISOString().slice(0, 10),
      dateTo: now.toISOString().slice(0, 10),
    };
  }, []);
  const [reportName, setReportName] = useState("");
  const [reportType, setReportType] = useState("sales_summary");
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultRange.dateTo);
  const [exportFormat, setExportFormat] = useState<"pdf" | "excel" | "csv">("pdf");
  const [reportData, setReportData] = useState<any>(null);
  const [reportHistory, setReportHistory] = useState<any[]>([]);
  const [viewReport, setViewReport] = useState<any>(null);

  const generateMutation = trpc.softwareReport.generate.useMutation({
    onSuccess: (data) => {
      setReportData(data);
      setReportHistory((prev) => [data, ...prev]);
      toast.success("Report generated");
    },
    onError: (err) => toast.error(err.message),
  });

  const generateReport = () => {
    if (!reportName.trim() || !dateFrom || !dateTo) {
      toast.error("Report name and date range are required");
      return;
    }
    generateMutation.mutate({
      reportName: reportName.trim(),
      reportType: reportType as any,
      dateFrom,
      dateTo,
      exportFormat,
    });
  };

  const handleExport = (report: any) => {
    exportReport({
      reportName: report.reportName,
      reportType: report.reportType,
      dateFrom: report.dateFrom,
      dateTo: report.dateTo,
      exportFormat: report.exportFormat || "pdf",
      summary: report.summary || {},
    });
    toast.success(`Downloading ${(report.exportFormat || "pdf").toUpperCase()} report`);
  };

  const removeReportFromHistory = (id: number) => {
    setReportHistory((prev) => prev.filter((r) => r.id !== id));
    setReportData((current: any) => (current?.id === id ? null : current));
    setViewReport((current: any) => (current?.id === id ? null : current));
    toast.success("Report removed from session");
  };

  const clearReportHistory = () => {
    setReportHistory([]);
    setReportData(null);
    setViewReport(null);
    toast.success("Session reports cleared");
  };

  const historyStats = {
    total: reportHistory.length,
    pdf: reportHistory.filter((r) => r.exportFormat === "pdf").length,
    excel: reportHistory.filter((r) => r.exportFormat === "excel").length,
    csv: reportHistory.filter((r) => r.exportFormat === "csv").length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <AppleCard hover={false} className="p-4 text-center">
          <div className="text-2xl font-bold">{historyStats.total}</div>
          <div className="text-sm text-muted-foreground">Session Reports</div>
        </AppleCard>
        <AppleCard hover={false} className="p-4 text-center">
          <div className="text-2xl font-bold">{historyStats.pdf}</div>
          <div className="text-sm text-muted-foreground">PDF</div>
        </AppleCard>
        <AppleCard hover={false} className="p-4 text-center">
          <div className="text-2xl font-bold">{historyStats.excel}</div>
          <div className="text-sm text-muted-foreground">Excel</div>
        </AppleCard>
        <AppleCard hover={false} className="p-4 text-center">
          <div className="text-2xl font-bold">{historyStats.csv}</div>
          <div className="text-sm text-muted-foreground">CSV</div>
        </AppleCard>
      </div>

      <AppleCard hover={false} className="p-4">
        <h3 className="mb-4 text-lg font-semibold">Generate Report</h3>
        {!canGenerate ? (
          <p className="text-sm text-muted-foreground">Report generation requires developer or admin access.</p>
        ) : (
          <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Report Name *</Label>
            <Input value={reportName} onChange={(e) => setReportName(e.target.value)} placeholder="Q1 Sales Summary" />
          </div>
          <div className="space-y-2">
            <Label>Report Type</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REPORT_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>From *</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
          <div className="space-y-2"><Label>To *</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
        </div>
        <div className="mt-4 space-y-2">
          <Label>Export Format</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "pdf" as const, label: "PDF", icon: FileText },
              { value: "excel" as const, label: "Excel", icon: FileSpreadsheet },
              { value: "csv" as const, label: "CSV", icon: FileText },
            ].map((fmt) => (
              <button
                key={fmt.value}
                type="button"
                onClick={() => setExportFormat(fmt.value)}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  exportFormat === fmt.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:bg-accent"
                )}
              >
                <fmt.icon className="h-4 w-4" />
                {fmt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="button" className="min-h-10 w-full sm:w-auto" onClick={generateReport} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? "Generating..." : "Generate"}
          </Button>
        </div>
          </>
        )}
      </AppleCard>

      {reportData && (
        <AppleCard hover={false} className="p-4">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h3 className="text-lg font-semibold">{reportData.reportName || REPORT_TYPES.find((r) => r.value === reportData.reportType)?.label}</h3>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">
                {reportData.dateFrom} — {reportData.dateTo}
              </div>
              <Button variant="outline" size="sm" onClick={() => handleExport(reportData)}>
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </div>
          </div>
          <ReportSummaryView reportType={reportData.reportType} summary={reportData.summary} />
        </AppleCard>
      )}

      {!reportData && (
        <EmptyState title="No report generated" description="Enter a report name, select type and date range, then click Generate." />
      )}

      {reportHistory.length > 0 && (
        <AppleCard hover={false} className="p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">Recent Reports (this session)</h3>
            <Button variant="outline" size="sm" onClick={clearReportHistory}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Clear all
            </Button>
          </div>
          <div className="-mx-1 overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 font-medium">Report Name</th>
                  <th className="text-left py-3 px-4 font-medium">Type</th>
                  <th className="text-left py-3 px-4 font-medium">Date Range</th>
                  <th className="text-left py-3 px-4 font-medium">Format</th>
                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reportHistory.map((report) => (
                  <tr key={report.id} className="border-b border-border/30 hover:bg-accent/50">
                    <td className="py-3 px-4 font-medium">{report.reportName}</td>
                    <td className="py-3 px-4">{REPORT_TYPES.find((r) => r.value === report.reportType)?.label || report.reportType}</td>
                    <td className="py-3 px-4 text-xs">{report.dateFrom} to {report.dateTo}</td>
                    <td className="py-3 px-4 uppercase text-xs">{report.exportFormat}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewReport(report)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleExport(report)} title="Download">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeReportFromHistory(report.id)} title="Remove">
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      <Dialog open={!!viewReport} onOpenChange={() => setViewReport(null)}>
        <DialogContent className={softwareFormDialogClass}>
          <DialogHeader>
            <DialogTitle>{viewReport?.reportName}</DialogTitle>
          </DialogHeader>
          {viewReport && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {viewReport.dateFrom} — {viewReport.dateTo} · {REPORT_TYPES.find((r) => r.value === viewReport.reportType)?.label}
              </div>
              <ReportSummaryView reportType={viewReport.reportType} summary={viewReport.summary} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setViewReport(null)}>Close</Button>
                <Button onClick={() => handleExport(viewReport)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== KANBAN TAB ====================
function KanbanTab({ isAdmin, canManage }: { isAdmin: boolean; canManage: boolean }) {
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [moveDialog, setMoveDialog] = useState<{ project: any; newStatus: string } | null>(null);

  const { data: projects, isLoading, refetch } = trpc.softwareProject.list.useQuery({ limit: 200 });
  const updateMutation = trpc.softwareProject.updateStatus.useMutation({
    onSuccess: () => {
      setMoveDialog(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const approveMutation = trpc.softwareProject.approve.useMutation({
    onSuccess: () => {
      setMoveDialog(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const projectsByStatus = useMemo(() => {
    const map: Record<string, any[]> = {};
    KANBAN_COLUMNS.forEach((col) => { map[col.id] = []; });
    projects?.items?.forEach((p: any) => {
      if (map[p.status]) map[p.status].push(p);
    });
    return map;
  }, [projects]);

  const confirmMove = () => {
    if (!moveDialog) return;
    const { project, newStatus } = moveDialog;
    if (newStatus === "approved") {
      if (!isAdmin) {
        toast.error("Only admins can approve projects");
        return;
      }
      approveMutation.mutate({ id: project.id, status: "approved" });
      return;
    }
    updateMutation.mutate({
      id: project.id,
      status: newStatus as "in_progress" | "testing" | "uat" | "completed" | "delivered",
    });
  };

  const requestMove = (project: any, direction: "next" | "prev") => {
    if (direction === "next" && project.status === "pending_approval") {
      if (!isAdmin) {
        toast.error("Only admins can approve projects");
        return;
      }
      setMoveDialog({ project, newStatus: "approved" });
      return;
    }
    if (!canManage) {
      toast.error("Only developers can move projects on the kanban board");
      return;
    }
    const nextStatus = direction === "next" ? VALID_NEXT[project.status] : VALID_PREV[project.status];
    if (!nextStatus) return;
    if (nextStatus === "approved") return;
    setMoveDialog({ project, newStatus: nextStatus });
  };

  const isBusy = updateMutation.isPending || approveMutation.isPending;

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><OniLoader size="lg" text="Loading kanban..." /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Project Kanban Board</h3>
          <p className="text-sm text-muted-foreground">
            {canManage
              ? "Move projects through approval → development → delivery"
              : "Review pending projects and approve submissions"}
          </p>
        </div>
      </div>

      <div className="software-dev-kanban">
        {KANBAN_COLUMNS.map((col) => (
          <div key={col.id} className="software-dev-kanban-column">
            <div className="mb-3 flex items-center gap-2">
              <div className={`h-3 w-3 shrink-0 rounded-full ${col.color}`} />
              <h3 className="text-sm font-semibold">{col.label}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {projectsByStatus[col.id]?.length || 0}
              </span>
            </div>
            <div className="space-y-2">
              {projectsByStatus[col.id]?.map((project: any) => (
                <div key={project.id}>
                  <AppleCard hover={false} className="cursor-pointer p-3 transition-shadow hover:shadow-md">
                    <div
                      className="space-y-2"
                      onClick={() => setSelectedProject(project)}
                      onKeyDown={(e) => e.key === "Enter" && setSelectedProject(project)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm line-clamp-2">{project.name}</h4>
                        <span className="text-xs font-mono text-muted-foreground shrink-0">
                          #{project.projectId}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {project.customerName || `Customer #${project.customerId}`}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {project.assignedDeveloperName || "Unassigned"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatProjectDate(project.startDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 pt-1">
                        {canManage && VALID_PREV[project.status] && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 min-h-9 text-xs"
                            disabled={isBusy}
                            onClick={(e) => {
                              e.stopPropagation();
                              requestMove(project, "prev");
                            }}
                          >
                            <ArrowLeft className="h-3 w-3 mr-1" />
                            Back
                          </Button>
                        )}
                        {project.status === "pending_approval" && isAdmin ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="ml-auto h-9 min-h-9 text-xs"
                            disabled={isBusy}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMoveDialog({ project, newStatus: "approved" });
                            }}
                          >
                            Approve
                          </Button>
                        ) : canManage && VALID_NEXT[project.status] && project.status !== "pending_approval" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ml-auto h-9 min-h-9 text-xs"
                            disabled={isBusy}
                            onClick={(e) => {
                              e.stopPropagation();
                              requestMove(project, "next");
                            }}
                          >
                            Next
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </AppleCard>
                </div>
              ))}
              {(!projectsByStatus[col.id] || projectsByStatus[col.id].length === 0) && (
                <div className="text-center py-8 text-xs text-muted-foreground border-2 border-dashed border-border/50 rounded-xl">
                  No projects
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
        <DialogContent className={softwareDialogSmClass}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KanbanSquare className="h-5 w-5 text-primary" />
              {selectedProject?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Project ID:</span>
              <span className="font-mono">{selectedProject?.projectId}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Status:</span>
              <span className="capitalize">{formatStatusLabel(selectedProject?.status || "")}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Customer:</span>
              <span>{selectedProject?.customerName}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Product:</span>
              <span>{selectedProject?.productName || `Product #${selectedProject?.productId}`}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Assigned Developer:</span>
              <span>{selectedProject?.assignedDeveloperName || "Unassigned"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Start Date:</span>
              <span>{formatProjectDate(selectedProject?.startDate)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Due Date:</span>
              <span>{formatProjectDate(selectedProject?.endDate)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Progress:</span>
              <span>{getProjectProgress(selectedProject?.status || "")}%</span>
            </div>
            {selectedProject?.description && (
              <div className="pt-2">
                <span className="text-muted-foreground block mb-1">Description:</span>
                <p className="text-muted-foreground">{selectedProject.description}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!moveDialog} onOpenChange={() => setMoveDialog(null)}>
        <DialogContent className={softwareDialogSmClass}>
          <DialogHeader>
            <DialogTitle>Move Project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Move <strong>{moveDialog?.project?.name}</strong> to{" "}
            <strong className="capitalize">{formatStatusLabel(moveDialog?.newStatus || "")}</strong>?
          </p>
          {moveDialog?.newStatus === "completed" && (
            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
              This will validate: admin approval, customer exists, product exists, linked sale, invoice exists, and outstanding balance = 0.
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setMoveDialog(null)}>Cancel</Button>
            <Button onClick={confirmMove} disabled={isBusy}>
              {isBusy ? "Moving..." : "Move"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


export default function SoftwareDevPage() {
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const { isAdmin } = useAuth();
  const canManage = !isAdmin;

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (VALID_TAB_IDS.has(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const selectTab = (tabId: string) => {
    setActiveTab(tabId);
    window.history.replaceState(null, "", `#${tabId}`);
  };

  return (
    <AnimatedPage className="max-w-full overflow-x-hidden pb-6">
      <PageHeader
        title="Software Development"
        description={isAdmin ? "Review and approve developer submissions" : "Manage products, projects, sales, and operations"}
        icon={<Code2 className="h-5 w-5" />}
      />

      <SoftwareTabNav tabs={TABS} activeTab={activeTab} onSelect={selectTab} />

      {/* Tab Content */}
      {activeTab === "dashboard" && <DashboardTab isAdmin={isAdmin} />}
      {activeTab === "products" && <ProductsTab isAdmin={isAdmin} canManage={canManage} />}
      {activeTab === "projects" && <ProjectsTab isAdmin={isAdmin} canManage={canManage} />}
      {activeTab === "customers" && <CustomersTab isAdmin={isAdmin} canManage={canManage} />}
      {activeTab === "sales" && <SalesTab isAdmin={isAdmin} canManage={canManage} />}
      {activeTab === "payments" && <PaymentsTab canManage={canManage} />}
      {activeTab === "invoices" && <SoftwareInvoicesTab isAdmin={isAdmin} />}
      {activeTab === "certificates" && <CertificatesTab isAdmin={isAdmin} />}
      {activeTab === "documents" && <DocumentsTab canManage={canManage} />}
      {activeTab === "payroll" && (
        <ModulePayrollTab
          isAdmin={isAdmin}
          teamRole="developer"
          teamName="Software Development"
          infoCardClassName="border-violet-200/50 bg-violet-50/40 dark:border-violet-900/40 dark:bg-violet-950/20"
          infoLinkClassName="text-violet-700 dark:text-violet-400"
        />
      )}
      {activeTab === "reports" && <ReportsTab canManage={canManage} isAdmin={isAdmin} />}
      {activeTab === "kanban" && <KanbanTab isAdmin={isAdmin} canManage={canManage} />}
    </AnimatedPage>
  );
}
