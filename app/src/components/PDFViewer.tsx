import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { ZoomIn, ZoomOut, Download } from "lucide-react";
import { Progress } from "./ui/progress";

interface PDFViewerProps {
  url?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
}

export function PDFViewer({ url, open, onOpenChange, title = "Document Viewer" }: PDFViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(false);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));

  const handleDownload = () => {
    if (url) {
      window.open(url, "_blank");
    }
  };

  if (!url) return null;

  const isImage = url.match(/\.(jpeg|jpg|png|gif|webp)$/i);
  const isPdf = url.endsWith(".pdf") || url.includes(".pdf");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0 flex-row items-center justify-between space-y-0">
          <DialogTitle className="truncate">{title}</DialogTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleZoomOut} disabled={zoom <= 50}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[60px] text-center">{zoom}%</span>
            <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={zoom >= 200}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-muted/50 rounded-lg">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Progress value={45} className="w-64" />
            </div>
          )}

          {isImage && (
            <img
              src={url}
              alt={title}
              className="max-w-full h-auto mx-auto"
              style={{ transform: `scale(${zoom / 100})` }}
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
            />
          )}

          {isPdf && (
            <iframe
              src={`${url}#zoom=${zoom}`}
              className="w-full h-full"
              title={title}
              onLoad={() => setLoading(false)}
            />
          )}

          {!isImage && !isPdf && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">Preview not available</p>
                <Button onClick={handleDownload}>Download File</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface FilePreviewProps {
  url?: string;
  fileName?: string;
  onClick?: () => void;
}

export function FilePreview({ url, fileName, onClick }: FilePreviewProps) {
  if (!url) return null;

  const isImage = url.match(/\.(jpeg|jpg|png|gif|webp)$/i);
  const isPdf = url.endsWith(".pdf") || url.includes(".pdf");

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative group overflow-hidden rounded-lg border hover:border-primary/50 transition-all"
    >
      {isImage ? (
        <img src={url} alt={fileName} className="w-full h-32 object-cover" />
      ) : (
        <div className="w-full h-32 flex items-center justify-center bg-muted">
          <span className="text-4xl font-bold text-muted-foreground">
            {isPdf ? "PDF" : "FILE"}
          </span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute bottom-2 left-2 right-2">
          <p className="text-xs text-white truncate">{fileName || "Document"}</p>
          <p className="text-xs text-white/70">Click to view</p>
        </div>
      </div>
    </button>
  );
}
