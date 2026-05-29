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
 * SecureFileLink — fetches authenticated files with credentials
 * and downloads them to the user's device.
 *
 * This is required because /uploads/* now requires authentication.
 * Regular <a href="/uploads/..."> links open in new tabs WITHOUT
 * sending cookies, causing 401 errors.
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
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) {
          if (response.status === 401) {
            toast.error("Please log in to access this file");
          } else {
            toast.error(`Failed to load file: ${response.statusText}`);
          }
          return;
        }

        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

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

        // Create a temporary link element to trigger download
        const link = document.createElement("a");
        link.style.display = "none";
        document.body.appendChild(link);

        // Set the href and download attributes
        link.href = blobUrl;
        link.download = fileName;

        // For PDFs, some browsers open in viewer despite download attribute.
        // We can try to force download by using a different MIME type approach,
        // but the most reliable way is to just let the user know it's downloading.
        link.click();

        // Cleanup
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        }, 100);

        toast.success(`Downloading: ${fileName}`);
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
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) {
          if (response.status === 401) {
            toast.error("Please log in to access this file");
          } else {
            toast.error(`Failed to load file: ${response.statusText}`);
          }
          return;
        }

        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

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

        // Create download link
        const link = document.createElement("a");
        link.style.display = "none";
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        }, 100);

        toast.success(`Downloading: ${fileName}`);
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
