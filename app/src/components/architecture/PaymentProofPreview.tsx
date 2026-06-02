import { useEffect, useState } from "react";
import { Loader2, ImageIcon, FileText, ExternalLink } from "lucide-react";
import { SecureFileLink } from "@/components/SecureFileLink";
import { isImageDocument } from "@contracts/upload";
import { cn } from "@/lib/utils";

interface PaymentProofPreviewProps {
  url?: string | null;
  fileName?: string;
  className?: string;
  compact?: boolean;
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url) || url.includes("/uploads/");
}

export function PaymentProofPreview({ url, fileName, className, compact }: PaymentProofPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setPreviewUrl(null);
      return;
    }

    if (!isImageUrl(url)) {
      setPreviewUrl(null);
      return;
    }

    let revoked: string | null = null;
    setLoading(true);
    setError(null);

    fetch(url, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load proof image");
        const blob = await res.blob();
        if (!blob.type.startsWith("image/")) throw new Error("Not an image file");
        revoked = URL.createObjectURL(blob);
        setPreviewUrl(revoked);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Preview unavailable");
        setPreviewUrl(null);
      })
      .finally(() => setLoading(false));

    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [url]);

  if (!url) {
    return (
      <div className={cn("rounded-xl border border-dashed border-amber-300/60 bg-amber-50/50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200", className)}>
        No payment proof uploaded.
      </div>
    );
  }

  const mimeGuess = isImageDocument("", fileName || url) || isImageUrl(url);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {mimeGuess ? <ImageIcon className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
          Payment Proof
        </div>
        <SecureFileLink
          url={url}
          label="Download"
          icon={mimeGuess ? "image" : "file"}
          className="text-primary hover:text-primary/80"
        />
      </div>

      {loading && (
        <div className="flex h-40 items-center justify-center rounded-xl border bg-muted/30">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && previewUrl && !compact && (
        <div className="overflow-hidden rounded-xl border bg-muted/20">
          <img src={previewUrl} alt="Payment proof" className="max-h-72 w-full object-contain bg-black/5 dark:bg-black/20" />
        </div>
      )}

      {!loading && !previewUrl && mimeGuess && error && (
        <p className="text-xs text-muted-foreground">{error} — use Download to view the file.</p>
      )}

      {!loading && !previewUrl && !mimeGuess && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Open proof document <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
