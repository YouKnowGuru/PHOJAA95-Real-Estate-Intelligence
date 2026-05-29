import { useState, useCallback, useId } from "react";
import { Upload, X, FileText, Image, Loader2 } from "lucide-react";
import {
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_HINT,
  resolveDocumentMimeType,
} from "@contracts/upload";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { SecureFileLink } from "./SecureFileLink";

interface FileUploaderProps {
  accept?: string;
  maxSize?: number;
  value?: string;
  onChange?: (url: string, meta?: { key: string; fileName: string; mimeType: string; fileSize: number }) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
  folder?: "properties" | "agreements" | "documents" | "verification" | "final" | "profiles" | "payslips" | "library";
}

export function FileUploader({
  accept = DOCUMENT_UPLOAD_ACCEPT,
  maxSize = 15 * 1024 * 1024,
  value,
  onChange,
  disabled,
  label,
  hint,
  folder = "documents",
}: FileUploaderProps) {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);


  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > maxSize) {
        setError(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
        return;
      }

      setUploading(true);
      setError(null);
      setProgress(0);

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const fileData = base64.split(",")[1];

        setProgress(50);

        const response = await fetch("/api/trpc/upload.upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            json: {
              file: fileData,
              fileName: file.name,
              mimeType: resolveDocumentMimeType(file.name, file.type),
              folder,
            },
          }),
        });

        const result = await response.json();
        
        // Handle batch response format
        let url: string | null = null;
        let uploadMeta: { key: string; fileName: string; mimeType: string; fileSize: number } | undefined;
        let errorMsg = "Upload failed - check server console";
        
        // Helper to extract tRPC error message (v11 format: error.json.message)
        const getErrorMessage = (error: unknown): string => {
          if (!error) return "Unknown error";
          if (typeof error === "string") return error;
          const err = error as Record<string, unknown>;
          // tRPC v11: error.json.message
          const jsonMsg = (err.json as Record<string, unknown>)?.message;
          if (typeof jsonMsg === "string") return jsonMsg;
          // Direct message
          if (typeof err.message === "string") return err.message;
          // Fallback
          try {
            return JSON.stringify(error);
          } catch {
            return "Unknown error";
          }
        };
        
        if (Array.isArray(result)) {
          const firstResult = result[0];
          
          if (firstResult?.result?.data?.json) {
            const data = firstResult.result.data.json;
            url = data.url;
            uploadMeta = { key: data.key, fileName: data.fileName, mimeType: data.mimeType, fileSize: data.fileSize };
          } else if (firstResult?.error) {
            errorMsg = getErrorMessage(firstResult.error);
          } else if (firstResult?.result?.data?.error) {
            errorMsg = getErrorMessage(firstResult.result.data.error);
          }
        } else if (result?.result?.data?.json) {
          const data = result.result.data.json;
          url = data.url;
          uploadMeta = { key: data.key, fileName: data.fileName, mimeType: data.mimeType, fileSize: data.fileSize };
        } else if (result?.error) {
          errorMsg = getErrorMessage(result.error);
        } else if (result?.result?.data?.error) {
          errorMsg = getErrorMessage(result.result.data.error);
        }
        
        if (url) {
          setProgress(100);
          onChange?.(url, uploadMeta);
        } else {
          throw new Error(errorMsg);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [maxSize, onChange, folder]
  );

  if (value) {
    const isImage = value.match(/\.(jpeg|jpg|png|gif|webp)$/i);
    return (
      <div className="relative group">
        <div className="flex items-center gap-3 p-4 border rounded-lg bg-background">
          {isImage ? (
            <Image className="h-8 w-8 text-green-500" />
          ) : (
            <FileText className="h-8 w-8 text-green-500" />
          )}
          <div className="flex-1 min-w-0">
            <SecureFileLink url={value} label="View Uploaded File" />
            <p className="text-xs text-muted-foreground">Click to open in new tab</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange?.("")}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium">{label}</label>}
      <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
        <input
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          disabled={disabled || uploading}
          className="hidden"
          id={inputId}
        />
        <label htmlFor={inputId} className="cursor-pointer">
          {uploading ? (
            <div className="space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground">Uploading... {progress}%</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">Click to upload</p>
              <p className="text-xs text-muted-foreground">
                {DOCUMENT_UPLOAD_HINT} up to {maxSize / 1024 / 1024}MB
              </p>
            </div>
          )}
        </label>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
