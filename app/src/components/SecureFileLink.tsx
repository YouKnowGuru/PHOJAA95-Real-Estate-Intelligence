import { useState, useCallback } from "react";
import { FileText, Image, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SecureFileLinkProps {
  url: string;
  label?: string;
  icon?: "file" | "image";
  className?: string;
}

/**
 * Download a file by opening it in a new tab.
 * The server will authenticate via cookies and serve the file.
 */
function downloadFile(url: string): void {
  // Open in new tab - browser will send cookies automatically
  // Server authenticates and serves file with Content-Disposition: attachment
  window.open(url, "_blank");
}

/**
 * SecureFileLink — opens authenticated files in a new tab for download.
 */
export function SecureFileLink({ url, label = "Download", icon = "file", className = "" }: SecureFileLinkProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!url) return;

      setLoading(true);
      
      // Simple approach: just open the URL in a new tab
      // The server handles auth via cookies
      downloadFile(url);
      
      setLoading(false);
      toast.success("File download started");
    },
    [url]
  );

  const Icon = icon === "image" ? Image : FileText;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-800 hover:underline disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {loading ? "Loading..." : label}
    </button>
  );
}

/**
 * Simple secure link for PropertyDetail page.
 */
export function SecureDocLink({ url, children, className = "" }: { url: string; children: React.ReactNode; className?: string }) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!url) return;

      setLoading(true);
      downloadFile(url);
      setLoading(false);
      toast.success("File download started");
    },
    [url]
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline ${className}`}
    >
      {children}
      {loading && <Loader2 className="h-3 w-3 animate-spin" />}
    </button>
  );
}
