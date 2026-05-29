import { useState, useCallback } from "react";
import { X, Image as ImageIcon, Loader2, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { cn } from "@/lib/utils";

/**
 * Fix Cloudinary f_auto URLs that may serve JXL (JPEG XL) format
 * which is not supported by Safari/iOS. Replace with f_jpg for universal compatibility.
 */
function fixCloudinaryUrl(url: string): string {
  if (!url) return url;
  return url.replace(/\/f_auto(?=\/,)/g, "/f_jpg");
}

interface CloudinaryImage {
  url: string;
  publicId?: string;
}

interface CloudinaryUploadProps {
  value?: CloudinaryImage[];
  onChange?: (images: CloudinaryImage[]) => void;
  disabled?: boolean;
  maxImages?: number;
  label?: string;
}

/**
 * Multiple Image Uploader using Cloudinary (Unsigned).
 * Requires VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env
 */
export function CloudinaryUpload({
  value = [],
  onChange,
  disabled,
  maxImages = 10,
  label = "Property Images",
}: CloudinaryUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Security: Do NOT use fallback values for Cloudinary credentials in production.
  // These must be set via environment variables. Using defaults exposes uploads
  // to unauthorized access or demo accounts.
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    console.error("Cloudinary configuration missing. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your .env file.");
  }

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (value.length + files.length > maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    const uploadedImages: CloudinaryImage[] = [...value];
    const totalFiles = files.length;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", uploadPreset);

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Cloudinary Error:", errorData);
          throw new Error(errorData.error?.message || "Failed to upload to Cloudinary. Check your Cloud Name and Preset.");
        }

        const data = await response.json();
        uploadedImages.push({
          url: data.secure_url,
          publicId: data.public_id,
        });

        setProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

      onChange?.(uploadedImages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [value, maxImages, onChange, cloudName, uploadPreset]);

  const removeImage = (index: number) => {
    const newList = [...value];
    newList.splice(index, 1);
    onChange?.(newList);
  };

  return (
    <div className="space-y-4">
      {label && <Label className="text-sm font-medium">{label}</Label>}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {/* Existing Images */}
        {value.map((img, index) => (
          <div key={img.publicId || img.url} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
            <img
              src={fixCloudinaryUrl(img.url)}
              alt={`Property ${index}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={() => removeImage(index)}
                disabled={disabled}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {/* Upload Button */}
        {value.length < maxImages && (
          <div className="relative aspect-square">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleUpload}
              disabled={disabled || uploading}
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
              id="cloudinary-upload"
            />
            <div className={cn(
              "w-full h-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all",
              uploading ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"
            )}>
              {uploading ? (
                <div className="flex flex-col items-center gap-2 px-4 w-full">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <Progress value={progress} className="h-1.5 w-full" />
                  <span className="text-[10px] font-medium text-primary">{progress}%</span>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary">
                    <Plus className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Add Images</span>
                  <span className="text-[10px] text-slate-400">Up to {maxImages - value.length} more</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
        </div>
      )}

      {!value.length && !uploading && (
        <div className="flex items-center gap-2 text-muted-foreground py-2">
          <ImageIcon className="h-4 w-4" />
          <p className="text-xs italic">No images uploaded yet. Show off your property with high-quality photos.</p>
        </div>
      )}
    </div>
  );
}

// Re-export Label since it's used in the template
import { Label } from "./ui/label";
