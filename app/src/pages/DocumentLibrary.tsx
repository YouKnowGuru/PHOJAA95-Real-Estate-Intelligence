import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { FileUploader } from "@/components/FileUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  FolderOpen,
  Plus,
  Search,
  Download,
  Trash2,
  Edit3,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const DEFAULT_CATEGORIES = ["General", "Legal", "Finance", "HR", "Templates", "Property"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentLibrary() {
  const { user, isAdmin } = useAuth();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<{
    id: number;
    title: string;
    description: string;
    category: string;
  } | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "General",
    fileUrl: "",
    storageKey: "",
    fileName: "",
    mimeType: "",
    fileSize: 0,
  });

  const { data, isLoading } = trpc.documentLibrary.list.useQuery({
    search: search || undefined,
    category: categoryFilter,
  });

  const { data: dbCategories } = trpc.documentLibrary.categories.useQuery();

  const categories = Array.from(
    new Set([...DEFAULT_CATEGORIES, ...(dbCategories ?? [])])
  ).sort();

  const createMutation = trpc.documentLibrary.create.useMutation({
    onSuccess: () => {
      toast.success("Document saved to library");
      utils.documentLibrary.list.invalidate();
      utils.documentLibrary.categories.invalidate();
      setShowAdd(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.documentLibrary.update.useMutation({
    onSuccess: () => {
      toast.success("Document updated");
      utils.documentLibrary.list.invalidate();
      utils.documentLibrary.categories.invalidate();
      setEditing(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.documentLibrary.delete.useMutation({
    onSuccess: () => {
      toast.success("Document deleted");
      utils.documentLibrary.list.invalidate();
      utils.documentLibrary.categories.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setForm({
      title: "",
      description: "",
      category: "General",
      fileUrl: "",
      storageKey: "",
      fileName: "",
      mimeType: "",
      fileSize: 0,
    });
  }

  const handleUpload = (
    url: string,
    meta?: { key: string; fileName: string; mimeType: string; fileSize: number }
  ) => {
    setForm((prev) => ({
      ...prev,
      fileUrl: url,
      storageKey: meta?.key ?? "",
      fileName: meta?.fileName ?? "",
      mimeType: meta?.mimeType ?? "",
      fileSize: meta?.fileSize ?? 0,
      title: prev.title || (meta?.fileName?.replace(/\.[^.]+$/, "") ?? ""),
    }));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fileUrl || !form.storageKey) {
      toast.error("Please upload a file first");
      return;
    }
    createMutation.mutate({
      title: form.title,
      description: form.description || undefined,
      category: form.category,
      storageKey: form.storageKey,
      fileUrl: form.fileUrl,
      fileName: form.fileName,
      mimeType: form.mimeType,
      fileSize: form.fileSize,
    });
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <FolderOpen className="h-7 w-7 text-primary" />
            Document Library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Store and download shared PDFs and images for your team
          </p>
        </div>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={() => {
              resetForm();
              setShowAdd(true);
            }}
            className="bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/20"
          >
            <Plus className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        </motion.div>
      </motion.div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title, filename, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          {items.length} document{items.length === 1 ? "" : "s"}
        </p>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">No documents yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Upload PDFs or images to keep them in one place and download whenever you need them.
            </p>
            <Button className="mt-4" onClick={() => setShowAdd(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Upload your first document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((doc, index) => {
            const isPdf = doc.mimeType === "application/pdf" || doc.fileName.endsWith(".pdf");
            const FileIcon = isPdf ? FileText : ImageIcon;
            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card className="border-border/50 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm hover:shadow-md transition-shadow h-full">
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <FileIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground truncate">{doc.title}</h3>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{doc.fileName}</p>
                      </div>
                    </div>

                    {doc.description && (
                      <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{doc.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <Badge variant="secondary" className="text-xs">
                        {doc.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatFileSize(doc.fileSize)}</span>
                    </div>

                    <p className="text-xs text-muted-foreground mt-2">
                      {doc.uploaderName ?? "Staff"} · {format(new Date(doc.createdAt), "dd MMM yyyy")}
                    </p>

                    <div className="flex gap-2 mt-4 pt-4 border-t border-border/50 mt-auto">
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                          Download
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          setEditing({
                            id: doc.id,
                            title: doc.title,
                            description: doc.description ?? "",
                            category: doc.category,
                          })
                        }
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      {(isAdmin || (user?.authType === "local" && doc.uploadedBy === user?.id)) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (confirm(`Delete "${doc.title}"?`)) {
                              deleteMutation.mutate({ id: doc.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Add a PDF or image to the shared library. Staff can download it anytime.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Document file *</Label>
              <FileUploader
                accept=".pdf,image/*"
                maxSize={10 * 1024 * 1024}
                folder="library"
                value={form.fileUrl}
                onChange={handleUpload}
                label="Choose file"
                hint="PDF, PNG, or JPEG up to 10MB"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-title">Title *</Label>
              <Input
                id="doc-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Company agreement template"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-category">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger id="doc-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-desc">Description (optional)</Label>
              <Textarea
                id="doc-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What is this document for?"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Save to Library"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>Update title, category, or description. File cannot be changed here.</DialogDescription>
          </DialogHeader>
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate({
                  id: editing.id,
                  title: editing.title,
                  description: editing.description || undefined,
                  category: editing.category,
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={editing.category}
                  onValueChange={(v) => setEditing({ ...editing, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
