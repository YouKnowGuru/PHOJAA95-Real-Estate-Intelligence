import { Link } from "react-router";
import { trpc } from "@/lib/trpc";
import { KPICard } from "@/components/ui/kpi-card";
import { OniLoader } from "@/components/ui/oni-loader";
import { SoftwareTabPanel } from "@/components/software-dev";
import { TabSectionHeader } from "../TabSectionHeader";
import { AppleCard } from "@/components/ui/apple-card";
import {
  Briefcase,
  ShoppingCart,
  Clock,
  DollarSign,
  CheckCircle,
  Award,
  FileText,
  CreditCard,
} from "lucide-react";

export default function DashboardTab() {
  const { data: dashboard, isLoading } = trpc.architectureDashboard.staff.useQuery();

  if (isLoading) {
    return (
      <SoftwareTabPanel>
        <div className="flex h-64 items-center justify-center">
          <OniLoader size="lg" text="Loading dashboard" />
        </div>
      </SoftwareTabPanel>
    );
  }

  return (
    <SoftwareTabPanel className="space-y-6">
      <TabSectionHeader
        title="Architecture Dashboard"
        description="Overview of projects, orders, revenue, and pending work."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link to="/architecture#projects" className="group">
          <AppleCard hover={false} className="p-4 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">My Projects</p>
                <p className="text-xs text-muted-foreground">{dashboard?.totalProjects ?? 0} total</p>
              </div>
              <Briefcase className="h-5 w-5 text-amber-500" />
            </div>
          </AppleCard>
        </Link>
        <Link to="/architecture#orders" className="group">
          <AppleCard hover={false} className="p-4 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">My Orders</p>
                <p className="text-xs text-muted-foreground">{dashboard?.inProgressOrders ?? 0} in progress</p>
              </div>
              <ShoppingCart className="h-5 w-5 text-green-600" />
            </div>
          </AppleCard>
        </Link>
        <Link to="/attendance" className="group">
          <AppleCard hover={false} className="p-4 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Attendance</p>
                <p className="text-xs text-muted-foreground">Check in / out</p>
              </div>
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
          </AppleCard>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Total Projects" value={dashboard?.totalProjects ?? 0} icon={Briefcase} />
        <KPICard title="Pending Review" value={dashboard?.pendingProjects ?? 0} icon={Clock} />
        <KPICard title="Active Orders" value={dashboard?.inProgressOrders ?? 0} icon={ShoppingCart} />
        <KPICard title="Revenue Collected" value={`Nu. ${(dashboard?.totalRevenue ?? 0).toLocaleString()}`} icon={DollarSign} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Approved Projects" value={dashboard?.approvedProjects ?? 0} icon={CheckCircle} />
        <KPICard title="Completed Projects" value={dashboard?.completedProjects ?? 0} icon={Award} />
        <KPICard title="Total Orders" value={dashboard?.totalOrders ?? 0} icon={FileText} />
        <KPICard title="Pending Revenue" value={`Nu. ${(dashboard?.pendingRevenue ?? 0).toLocaleString()}`} icon={CreditCard} />
      </div>
    </SoftwareTabPanel>
  );
}
