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
 * Download a file via fetch with credentials, then trigger a browser download
 * using a Blob URL. This avoids CDN compression issues that can corrupt
 * binary files when using window.open() directly.
 */
async function downloadFile(url: string, fileName?: string): Promise<void> {
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    // Prevent the browser from sending Accept-Encoding; let the server/CDN
    // know we want the raw file, not a compressed variant.
    headers: {
      "Accept-Encoding": "identity",
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Please log in to download this file");
    }
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();

  // Derive filename from Content-Disposition header if available
  let name = fileName;
  if (!name) {
    const disposition = response.headers.get("Content-Disposition");
    if (disposition) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match) name = match[1];
    }
  }
  if (!name) {
    // Fallback: extract from URL path
    try {
      name = decodeURIComponent(new URL(url, window.location.href).pathname.split("/").pop() || "download");
    } catch {
      name = "download";
    }
  }

  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the Blob URL after a short delay to allow the download to start
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5000);
}

/**
 * SecureFileLink — downloads authenticated files via fetch+blob to avoid
 * CDN compression corruption.
 */
export function SecureFileLink({ url, label = "Download", icon = "file", className = "" }: SecureFileLinkProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      if (!url) return;

      setLoading(true);
      try {
        await downloadFile(url);
        toast.success("File download started");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Download failed");
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
      {loading ? "Downloading..." : label}
    </button>
  );
}

/**
 * Simple secure link for PropertyDetail page.
 */
export function SecureDocLink({ url, children, className = "" }: { url: string; children: React.ReactNode; className?: string }) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      if (!url) return;

      setLoading(true);
      try {
        await downloadFile(url);
        toast.success("File download started");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Download failed");
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
