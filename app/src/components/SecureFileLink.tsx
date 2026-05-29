import { useState, useCallback } from "react";
import { FileText, Image, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface SecureFileLinkProps {
  url: string;
  label?: string;
  icon?: "file" | "image";
  className?: string;
}

/**
 * SecureFileLink — downloads authenticated files using signed URLs.
 * 
 * The process:
 * 1. Extract the file key from the URL
 * 2. Call tRPC to get a signed download URL
 * 3. Use the signed URL to download the file directly
 * 
 * This avoids cookie/auth issues with fetch() + blob().
 */
export function SecureFileLink({ url, label = "Download", icon = "file", className = "" }: SecureFileLinkProps) {
  const [loading, setLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  
  // Use useQuery for fetching signed URL (GET request)
  const { refetch } = trpc.upload.getDownloadUrl.useQuery(
    { key: url.replace(/^\/uploads\//, "") },
    { enabled: false } // Don't fetch automatically
  );

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!url) return;

      setLoading(true);
      try {
        // Extract file key from URL (e.g., "/uploads/documents/abc.pdf" -> "documents/abc.pdf")
        const key = url.replace(/^\/uploads\//, "");
        
        if (!key) {
          toast.error("Invalid file URL");
          return;
        }

        // Get signed URL from server using refetch (GET request)
        const result = await refetch();
        
        if (!result.data?.url) {
          toast.error("Failed to get download URL");
          return;
        }

        // Extract filename from URL
        const urlParts = url.split("/");
        const fileName = urlParts[urlParts.length - 1] || "download";

        // Create a temporary link and click it
        const link = document.createElement("a");
        link.href = result.data.url;
        link.download = fileName;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(link);
        }, 100);

        toast.success(`Downloading: ${fileName}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to download file";
        toast.error(message);
        console.error("Download error:", err);
      } finally {
        setLoading(false);
      }
    },
    [url, refetch]
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
  
  // Use useQuery for fetching signed URL (GET request)
  const { refetch } = trpc.upload.getDownloadUrl.useQuery(
    { key: url.replace(/^\/uploads\//, "") },
    { enabled: false }
  );

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!url) return;

      setLoading(true);
      try {
        // Extract file key from URL
        const key = url.replace(/^\/uploads\//, "");
        
        if (!key) {
          toast.error("Invalid file URL");
          return;
        }

        // Get signed URL from server using refetch (GET request)
        const result = await refetch();
        
        if (!result.data?.url) {
          toast.error("Failed to get download URL");
          return;
        }

        // Extract filename
        const urlParts = url.split("/");
        const fileName = urlParts[urlParts.length - 1] || "download";

        // Download using signed URL
        const link = document.createElement("a");
        link.href = result.data.url;
        link.download = fileName;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
          document.body.removeChild(link);
        }, 100);

        toast.success(`Downloading: ${fileName}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to download file";
        toast.error(message);
        console.error("Download error:", err);
      } finally {
        setLoading(false);
      }
    },
    [url, refetch]
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
