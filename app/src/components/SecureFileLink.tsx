import { useState, useCallback } from "react";
import { FileText, Image, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SecureFileLinkProps {
  url: string;
  label: string;
  icon?: "file" | "image";
  className?: string;
  /** If true, force download instead of opening in browser */
  download?: boolean;
}

/**
 * SecureFileLink — fetches authenticated files with credentials
 * and opens them via blob URL in new tab or download.
 *
 * This is required because /uploads/* now requires authentication.
 * Regular <a href="/uploads/..."> links open in new tabs WITHOUT
 * sending cookies, causing 401 errors.
 */
export function SecureFileLink({ url, label, icon = "file", className = "", download = false }: SecureFileLinkProps) {
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

        // Extract filename from URL
        const urlParts = url.split("/");
        const fileName = urlParts[urlParts.length - 1] || "download";

        const isPdf = blob.type === "application/pdf";
        const forceDownload = download || !isPdf;

        if (forceDownload) {
          // Force download
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          // Open PDF in new tab using iframe
          const newWindow = window.open("", "_blank");
          if (!newWindow) {
            toast.error("Popup blocked. Please allow popups for this site.");
            URL.revokeObjectURL(blobUrl);
            return;
          }
          newWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>${fileName}</title>
                <style>
                  body { margin: 0; padding: 0; overflow: hidden; }
                  iframe { width: 100vw; height: 100vh; border: none; }
                </style>
              </head>
              <body>
                <iframe src="${blobUrl}" type="application/pdf"></iframe>
              </body>
            </html>
          `);
          newWindow.document.close();
        }

        // Clean up blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      } catch (err) {
        toast.error("Failed to load file. Please try again.");
        console.error("File fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [url, download]
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
export function SecureDocLink({ url, children, className = "", download = false }: { url: string; children: React.ReactNode; className?: string; download?: boolean }) {
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

        const isPdf = blob.type === "application/pdf";
        const forceDownload = download || !isPdf;

        if (forceDownload) {
          // Force download
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          // Open PDF in new tab using iframe
          const newWindow = window.open("", "_blank");
          if (!newWindow) {
            toast.error("Popup blocked. Please allow popups for this site.");
            URL.revokeObjectURL(blobUrl);
            return;
          }
          newWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>${fileName}</title>
                <style>
                  body { margin: 0; padding: 0; overflow: hidden; }
                  iframe { width: 100vw; height: 100vh; border: none; }
                </style>
              </head>
              <body>
                <iframe src="${blobUrl}" type="application/pdf"></iframe>
              </body>
            </html>
          `);
          newWindow.document.close();
        }

        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      } catch (err) {
        toast.error("Failed to load file. Please try again.");
        console.error("File fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [url, download]
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
