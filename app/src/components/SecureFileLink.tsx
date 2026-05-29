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
 * SecureFileLink — opens authenticated files in a new tab for download.
 *
 * The server sends Content-Disposition: attachment for PDFs which forces download.
 * The browser handles the download natively without corrupting the file.
 */
export function SecureFileLink({ url, label = "Download", icon = "file", className = "" }: SecureFileLinkProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!url) return;

      // Validate URL
      if (!url.startsWith("/") && !url.startsWith("http")) {
        toast.error("Invalid file URL");
        return;
      }

      setLoading(true);
      try {
        // First, verify the file is accessible by making a HEAD request
        const response = await fetch(url, { 
          method: "HEAD",
          credentials: "include" 
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            toast.error("Please log in to access this file");
          } else {
            toast.error(`Failed to access file: ${response.statusText}`);
          }
          setLoading(false);
          return;
        }

        // Extract filename from URL
        let fileName = "download";
        const contentDisposition = response.headers.get("content-disposition");
        if (contentDisposition) {
          const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (match) fileName = match[1].replace(/['"]/g, "");
        } else {
          const urlParts = url.split("/");
          fileName = urlParts[urlParts.length - 1] || "download";
          fileName = fileName.split("?")[0];
        }

        // Open in new tab - the server will send the file with proper headers
        // Content-Disposition: attachment forces download
        // The browser handles the download natively without corrupting the file
        const newWindow = window.open(url, "_blank");
        if (!newWindow) {
          toast.error("Popup blocked. Please allow popups for this site.");
          setLoading(false);
          return;
        }

        toast.success(`Downloading: ${fileName}`);
        
        // Close the empty tab after a moment if the browser didn't navigate it
        setTimeout(() => {
          try {
            if (newWindow.location.href === "about:blank") {
              newWindow.close();
            }
          } catch {
            // Cross-origin, ignore
          }
        }, 2000);
      } catch (err) {
        toast.error("Failed to download file. Please try again.");
        console.error("File download error:", err);
      } finally {
        setLoading(false);
      }
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
 * Simple secure link for PropertyDetail page that matches the existing anchor style.
 */
export function SecureDocLink({ url, children, className = "" }: { url: string; children: React.ReactNode; className?: string }) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!url) return;

      setLoading(true);
      try {
        // Verify access first
        const response = await fetch(url, { 
          method: "HEAD",
          credentials: "include" 
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            toast.error("Please log in to access this file");
          } else {
            toast.error(`Failed to access file: ${response.statusText}`);
          }
          setLoading(false);
          return;
        }

        // Extract filename
        let fileName = "download";
        const contentDisposition = response.headers.get("content-disposition");
        if (contentDisposition) {
          const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (match) fileName = match[1].replace(/['"]/g, "");
        } else {
          const urlParts = url.split("/");
          fileName = urlParts[urlParts.length - 1] || "download";
          fileName = fileName.split("?")[0];
        }

        // Open in new tab for download
        const newWindow = window.open(url, "_blank");
        if (!newWindow) {
          toast.error("Popup blocked. Please allow popups for this site.");
          setLoading(false);
          return;
        }

        toast.success(`Downloading: ${fileName}`);
        
        setTimeout(() => {
          try {
            if (newWindow.location.href === "about:blank") {
              newWindow.close();
            }
          } catch {
            // Ignore
          }
        }, 2000);
      } catch (err) {
        toast.error("Failed to download file. Please try again.");
        console.error("File download error:", err);
      } finally {
        setLoading(false);
      }
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
