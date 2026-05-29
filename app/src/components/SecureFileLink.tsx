import { useState, useCallback } from "react";
import { FileText, Image, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SecureFileLinkProps {
  url: string;
  label: string;
  icon?: "file" | "image";
  className?: string;
}

/**
 * SecureFileLink — fetches authenticated files with credentials
 * and opens them via download or object URL.
 *
 * This is required because /uploads/* now requires authentication.
 * Regular <a href="/uploads/..."> links open in new tabs WITHOUT
 * sending cookies, causing 401 errors.
 */
export function SecureFileLink({ url, label, icon = "file", className = "" }: SecureFileLinkProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      if (!url) return;

      // Validate URL
      if (url.startsWith("/")) {
        // relative URL — ok
      } else {
        try {
          const u = new URL(url);
          if (u.protocol !== "http:" && u.protocol !== "https:") {
            toast.error("Invalid file URL");
            return;
          }
        } catch {
          toast.error("Invalid file URL");
          return;
        }
      }

      setLoading(true);
      try {
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) {
          if (response.status === 401) {
            toast.error("Please log in to view this file");
          } else {
            toast.error(`Failed to load file: ${response.statusText}`);
          }
          return;
        }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        // Extract filename from URL or use default
        const urlParts = url.split("/");
        const fileName = urlParts[urlParts.length - 1] || "download";

        // Create download link
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Clean up blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      } catch (err) {
        toast.error("Failed to load file. Please try again.");
        console.error("File fetch error:", err);
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
      if (!url) return;

      setLoading(true);
      try {
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) {
          if (response.status === 401) {
            toast.error("Please log in to view this file");
          } else {
            toast.error(`Failed to load file: ${response.statusText}`);
          }
          return;
        }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        // Extract filename from URL
        const urlParts = url.split("/");
        const fileName = urlParts[urlParts.length - 1] || "download";

        // Create download link
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      } catch (err) {
        toast.error("Failed to load file. Please try again.");
        console.error("File fetch error:", err);
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
