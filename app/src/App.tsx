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
      <Route path="/reset-password" element={
        <Suspense fallback={<PageLoader />}>
          <ResetPassword />
        </Suspense>
      } />
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
            <Suspense fallback={<PageLoader />}>
              <PropertyWizard />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/properties/:id"
        element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <PropertyDetail />
            </Suspense>
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
            <Suspense fallback={<PageLoader />}>
              <ApprovalQueue />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute requireAdmin>
            <Suspense fallback={<PageLoader />}>
              <Users />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/property-types"
        element={
          <ProtectedRoute requireAdmin>
            <Suspense fallback={<PageLoader />}>
              <PropertyTypes />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance"
        element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Attendance />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/payroll"
        element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Payroll />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/activity-logs"
        element={
          <ProtectedRoute requireAdmin>
            <Suspense fallback={<PageLoader />}>
              <ActivityLogs />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute requireAdmin>
            <Suspense fallback={<PageLoader />}>
              <Reports />
            </Suspense>
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
            <Suspense fallback={<PageLoader />}>
              <Billing />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <DocumentLibrary />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
