import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { KPICard } from "@/components/ui/kpi-card";
import { AppleCard } from "@/components/ui/apple-card";
import { OniLoader } from "@/components/ui/oni-loader";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Package,
  Briefcase,
  ShoppingCart,
  CreditCard,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"];

export default function SoftwareDevDashboard() {
  const { isAdmin } = useAuth();
  const { data: devStats, isLoading: devLoading } = trpc.softwareDashboard.developer.useQuery();
  const { data: adminStats, isLoading: adminLoading } = trpc.softwareDashboard.admin.useQuery(undefined, {
    enabled: isAdmin,
  });

  const stats = isAdmin && adminStats ? { ...devStats, ...adminStats } : devStats;
  const isLoading = devLoading || (isAdmin && adminLoading);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <OniLoader size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  const monthlySalesData = stats?.monthlySales?.map((item: any) => ({
    month: item.month,
    revenue: Number(item.total || 0),
    sales: item.count,
  })) || [];

  const projectStatusData = stats?.projectStatus?.map((item: any) => ({
    name: item.status.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
    value: item.count,
  })) || [];

  const paymentStatusData = stats?.paymentStatus?.map((item: any) => ({
    name: item.status.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
    value: item.count,
  })) || [];

  return (
    <AnimatedPage>
      <PageHeader
        title="Software Development Dashboard"
        description="Overview of your software development operations"
        icon={<Package className="h-5 w-5" />}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Total Products"
          value={stats?.totalProducts || 0}
          icon={Package}
          trend="+12%"
          trendUp={true}
        />
        <KPICard
          title="Active Projects"
          value={stats?.activeProjects || 0}
          icon={Briefcase}
          trend="+5%"
          trendUp={true}
        />
        <KPICard
          title="Pending Sales"
          value={stats?.pendingSales || 0}
          icon={ShoppingCart}
          trend="-2%"
          trendUp={false}
        />
        <KPICard
          title="Total Revenue"
          value={`Nu.${(stats?.totalRevenue || 0).toLocaleString()}`}
          icon={DollarSign}
          trend="+18%"
          trendUp={true}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Pending Projects"
          value={stats?.pendingProjects || 0}
          icon={Clock}
          color="bg-amber-500"
        />
        <KPICard
          title="Completed Projects"
          value={stats?.completedProjects || 0}
          icon={CheckCircle}
          color="bg-emerald-500"
        />
        <KPICard
          title="Approved Sales"
          value={stats?.approvedSales || 0}
          icon={TrendingUp}
          color="bg-blue-500"
        />
        <KPICard
          title="Outstanding Payments"
          value={`Nu.${(stats?.outstandingPayments || 0).toLocaleString()}`}
          icon={CreditCard}
          color="bg-red-500"
        />
      </div>

      {/* Admin-specific stats */}
      {isAdmin && adminStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard
            title="Total Developers"
            value={adminStats.totalDevelopers || 0}
            icon={Package}
            color="bg-blue-500"
          />
          <KPICard
            title="Pending Product Approvals"
            value={adminStats.pendingProductApprovals || 0}
            icon={Package}
            color="bg-amber-500"
          />
          <KPICard
            title="Pending Project Approvals"
            value={adminStats.pendingProjectApprovals || 0}
            icon={Briefcase}
            color="bg-amber-500"
          />
          <KPICard
            title="Pending Sales Approvals"
            value={adminStats.pendingSalesApprovals || 0}
            icon={ShoppingCart}
            color="bg-amber-500"
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AppleCard className="lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">Monthly Sales</h3>
          {monthlySalesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlySalesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No sales data" description="Sales data will appear here once transactions are recorded." />
          )}
        </AppleCard>

        <AppleCard>
          <h3 className="text-lg font-semibold mb-4">Project Status</h3>
          {projectStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={projectStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {projectStatusData.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No project data" description="Project status distribution will appear here." />
          )}
        </AppleCard>
      </div>

      {/* Payment Status Chart */}
      <div className="mt-6">
        <AppleCard>
          <h3 className="text-lg font-semibold mb-4">Payment Status Distribution</h3>
          {paymentStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={paymentStatusData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip />
                <Bar dataKey="value" fill="#82CA9D" name="Count" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No payment data" description="Payment status will appear here once payments are recorded." />
          )}
        </AppleCard>
      </div>
    </AnimatedPage>
  );
}
