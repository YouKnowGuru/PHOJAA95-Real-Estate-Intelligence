import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidMount() {
    // Clear reload flag after successful mount to allow future reload attempts if needed
    sessionStorage.removeItem("chunk-error-reload");
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Check if it's a chunk loading/dynamic import error
    const errorMessage = error?.message || "";
    const isChunkLoadError =
      errorMessage.includes("Failed to fetch dynamically imported module") ||
      errorMessage.includes("Importing a module script failed") ||
      errorMessage.includes("error loading dynamically imported module") ||
      errorMessage.includes("chunk") ||
      errorMessage.includes("dynamic import");

    if (isChunkLoadError) {
      console.warn("Chunk load error detected in ErrorBoundary, attempting to reload...");
      const lastReload = sessionStorage.getItem("chunk-error-reload");
      const now = Date.now();
      // Only reload if we haven't reloaded in the last 10 seconds to prevent infinite reload loops
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem("chunk-error-reload", now.toString());
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
          <h1 className="mb-2 text-3xl font-bold text-destructive">Something went wrong</h1>
          <p className="mb-6 max-w-md text-muted-foreground">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          {this.state.error && (
            <pre className="mb-6 max-w-lg overflow-auto rounded-md bg-muted p-4 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
