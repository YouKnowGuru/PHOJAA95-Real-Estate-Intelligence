import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/hooks/use-theme";
import './index.css'
import 'leaflet/dist/leaflet.css'
import { TRPCProvider } from "@/providers/trpc"
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import App from './App.tsx'

function AppFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Skeleton className="h-32 w-32" />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider defaultTheme="system" storageKey="phojaa95-theme">
          <TRPCProvider>
            <Suspense fallback={<AppFallback />}>
              <App />
            </Suspense>
            <Toaster position="top-right" richColors />
          </TRPCProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
