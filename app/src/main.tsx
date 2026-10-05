import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/hooks/use-theme";
import { OniLoader } from "@/components/ui/oni-loader";
import './index.css'
import 'leaflet/dist/leaflet.css'
import { TRPCProvider } from "@/providers/trpc"
import { RouteErrorBoundary as ErrorBoundary } from "@/components/ErrorBoundary";
import App from './App.tsx'

// Handle Vite chunk load/preload errors automatically by reloading the page
window.addEventListener("vite:preloadError", (event) => {
  console.warn("Vite preload error detected, reloading page...", event);
  const lastReload = sessionStorage.getItem("chunk-error-reload");
  const now = Date.now();
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    sessionStorage.setItem("chunk-error-reload", now.toString());
    window.location.reload();
  }
});

function AppFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <OniLoader size="lg" text="Starting up" />
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
            <Toaster position="top-right" richColors duration={4000} closeButton />
          </TRPCProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
