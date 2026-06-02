import { useState, useCallback, useId } from "react";
import { Upload, X, FileText, Image, Loader2 } from "lucide-react";
import {
  ARCHITECTURE_UPLOAD_ACCEPT,
  ARCHITECTURE_UPLOAD_HINT,
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_HINT,
  resolveArchitectureMimeType,
  resolveDocumentMimeType,
} from "@contracts/upload";
import { trpc } from "@/lib/trpc";
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
  folder?: "properties" | "agreements" | "documents" | "verification" | "final" | "profiles" | "payslips" | "library" | "architecture";
  /** architecture = allow CAD/video; standard = property/library document types only */
  mode?: "standard" | "architecture";
}

export function FileUploader({
  accept,
  maxSize = 10 * 1024 * 1024,
  value,
  onChange,
  disabled,
  label,
  hint,
  folder = "documents",
  mode = "standard",
}: FileUploaderProps) {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = trpc.upload.upload.useMutation();

  const isArchitecture = mode === "architecture" || folder === "architecture";
  const resolvedAccept = accept ?? (isArchitecture ? ARCHITECTURE_UPLOAD_ACCEPT : DOCUMENT_UPLOAD_ACCEPT);
  const defaultHint = isArchitecture ? ARCHITECTURE_UPLOAD_HINT : DOCUMENT_UPLOAD_HINT;

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      if (file.size > maxSize) {
        setError(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
        return;
      }

      setUploading(true);
      setError(null);
      setProgress(20);

      try {
        const fileData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.includes(",") ? result.split(",")[1] : result;
            resolve(base64);
          };
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });

        setProgress(55);

        const mimeType = isArchitecture
          ? resolveArchitectureMimeType(file.name, file.type)
          : resolveDocumentMimeType(file.name, file.type);

        const result = await uploadMutation.mutateAsync({
          file: fileData,
          fileName: file.name,
          mimeType,
          folder,
        });

        setProgress(100);
        onChange?.(result.url, {
          key: result.key,
          fileName: result.fileName,
          mimeType: result.mimeType,
          fileSize: result.fileSize,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [maxSize, onChange, folder, isArchitecture, uploadMutation]
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
            disabled={disabled || uploading}
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
          accept={resolvedAccept}
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
                {defaultHint} up to {maxSize / 1024 / 1024}MB
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
