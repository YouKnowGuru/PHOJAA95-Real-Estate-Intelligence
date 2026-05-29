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

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
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
    return <Navigate to="/" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
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
            <Properties />
          </ProtectedRoute>
        }
      />
      <Route
        path="/properties/new"
        element={
          <ProtectedRoute>
            <LazyRoute><PropertyWizard /></LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/properties/:id"
        element={
          <ProtectedRoute>
            <LazyRoute><PropertyDetail /></LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/properties/:id/wizard"
        element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <PropertyWizard />
            </Suspense>
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
            <LazyRoute><Billing /></LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <LazyRoute><DocumentLibrary /></LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
