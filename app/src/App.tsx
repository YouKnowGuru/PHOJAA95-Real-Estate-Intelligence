import { useEffect, useState, Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import { OniLoader } from "./components/ui/oni-loader";
import { RouteErrorBoundary } from "./components/ErrorBoundary";
import { getHomeRouteForRole } from "@/lib/role-routing";

// Lazy load heavy pages to reduce initial bundle size
const PropertyDetail = lazy(() => import("./pages/PropertyDetail"));
const PropertyWizard = lazy(() => import("./pages/PropertyWizard"));
const ApprovalQueue = lazy(() => import("./pages/ApprovalQueue"));
const Users = lazy(() => import("./pages/Users"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Payroll = lazy(() => import("./pages/Payroll"));
const ActivityLogs = lazy(() => import("./pages/ActivityLogs"));
const Reports = lazy(() => import("./pages/Reports"));
const PropertyTypes = lazy(() => import("./pages/PropertyTypes"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Billing = lazy(() => import("./pages/Billing"));
const DocumentLibrary = lazy(() => import("./pages/DocumentLibrary"));

// Software Development Module page
const SoftwareDevPage = lazy(() => import("./pages/software-dev/SoftwareDevPage"));

// Architecture Management Module
const ArchitecturePage = lazy(() => import("./pages/architecture/ArchitecturePage"));
const ArchitecturePortalPage = lazy(() => import("./pages/architecture/ArchitecturePortalPage"));
const VerifyArchitectureCertificatePage = lazy(() => import("./pages/architecture/VerifyCertificatePage"));

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <OniLoader size="lg" text="Loading" />
    </div>
  );
}

/** Wrap lazy-loaded routes with error boundary */
function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </RouteErrorBoundary>
  );
}

function ProtectedRoute({ children, requireAdmin = false, requireDeveloper = false, requireArchitectureStaff = false }: { children: React.ReactNode; requireAdmin?: boolean; requireDeveloper?: boolean; requireArchitectureStaff?: boolean }) {
  const { user, isAuthenticated, isLoading, isAdmin, isDeveloper, isArchitectureStaff } = useAuth();
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowLoader(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (isLoading || showLoader) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to={getHomeRouteForRole(user?.role)} replace />;
  }

  if (requireDeveloper && !isDeveloper && !isAdmin) {
    return <Navigate to={getHomeRouteForRole(user?.role)} replace />;
  }

  if (requireArchitectureStaff && !isArchitectureStaff && !isAdmin) {
    return <Navigate to={getHomeRouteForRole(user?.role)} replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

/** Blocks module-specific staff from real-estate property workflows. */
function RealEstateStaffRoute({ children }: { children: React.ReactNode }) {
  const { user, isArchitectureStaff, isDeveloper } = useAuth();

  if (isArchitectureStaff || isDeveloper) {
    return <Navigate to={getHomeRouteForRole(user?.role)} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<LazyRoute><ResetPassword /></LazyRoute>} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/properties"
        element={
          <ProtectedRoute>
            <RealEstateStaffRoute>
              <Properties />
            </RealEstateStaffRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/properties/new"
        element={
          <ProtectedRoute>
            <RealEstateStaffRoute>
              <LazyRoute><PropertyWizard /></LazyRoute>
            </RealEstateStaffRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/properties/:id"
        element={
          <ProtectedRoute>
            <RealEstateStaffRoute>
              <LazyRoute><PropertyDetail /></LazyRoute>
            </RealEstateStaffRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/properties/:id/wizard"
        element={
          <ProtectedRoute>
            <RealEstateStaffRoute>
              <Suspense fallback={<PageLoader />}>
                <PropertyWizard />
              </Suspense>
            </RealEstateStaffRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/approvals"
        element={
          <ProtectedRoute requireAdmin>
            <LazyRoute><ApprovalQueue /></LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute requireAdmin>
            <LazyRoute><Users /></LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/property-types"
        element={
          <ProtectedRoute requireAdmin>
            <LazyRoute><PropertyTypes /></LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance"
        element={
          <ProtectedRoute>
            <LazyRoute><Attendance /></LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/payroll"
        element={
          <ProtectedRoute>
            <LazyRoute><Payroll /></LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/activity-logs"
        element={
          <ProtectedRoute requireAdmin>
            <LazyRoute><ActivityLogs /></LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute requireAdmin>
            <LazyRoute><Reports /></LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing"
        element={
          <ProtectedRoute>
            <RealEstateStaffRoute>
              <LazyRoute><Billing /></LazyRoute>
            </RealEstateStaffRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <RealEstateStaffRoute>
              <LazyRoute><DocumentLibrary /></LazyRoute>
            </RealEstateStaffRoute>
          </ProtectedRoute>
        }
      />
      {/* Software Development Module Route */}
      <Route
        path="/software-dev"
        element={
          <ProtectedRoute requireDeveloper>
            <LazyRoute><SoftwareDevPage /></LazyRoute>
          </ProtectedRoute>
        }
      />
      {/* Architecture Management Module Route */}
      <Route
        path="/architecture"
        element={
          <ProtectedRoute requireArchitectureStaff>
            <LazyRoute><ArchitecturePage /></LazyRoute>
          </ProtectedRoute>
        }
      />
      {/* Public Architecture Customer Portal */}
      <Route
        path="/portal/architecture/:token"
        element={<LazyRoute><ArchitecturePortalPage /></LazyRoute>}
      />
      {/* Public Certificate Verification */}
      <Route
        path="/verify/architecture/:verificationNumber"
        element={<LazyRoute><VerifyArchitectureCertificatePage /></LazyRoute>}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
