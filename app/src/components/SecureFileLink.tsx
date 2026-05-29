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
 * Download a file from an authenticated URL.
 * Uses fetch with credentials, then creates a download link.
 */
async function downloadFile(url: string): Promise<void> {
  // Fetch the file with authentication cookies
  const response = await fetch(url, { 
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Please log in to access this file");
    }
    throw new Error(`Failed to load file: ${response.statusText}`);
  }

  // Get filename from Content-Disposition header or URL
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

  // CRITICAL: Use arrayBuffer() instead of blob() to preserve binary data
  const arrayBuffer = await response.arrayBuffer();
  
  // Create blob from array buffer with explicit MIME type
  // This prevents browser from corrupting the binary data
  const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });

  // Create object URL and trigger download
  const blobUrl = window.URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  }, 100);
}

/**
 * SecureFileLink — fetches authenticated files with credentials
 * and downloads them to the user's device.
 */
export function SecureFileLink({ url, label = "Download", icon = "file", className = "" }: SecureFileLinkProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!url) return;

      if (!url.startsWith("/") && !url.startsWith("http")) {
        toast.error("Invalid file URL");
        return;
      }

      setLoading(true);
      try {
        await downloadFile(url);
        toast.success("File downloaded");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to download file";
        toast.error(message);
        console.error("Download error:", err);
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
        await downloadFile(url);
        toast.success("File downloaded");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to download file";
        toast.error(message);
        console.error("Download error:", err);
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
