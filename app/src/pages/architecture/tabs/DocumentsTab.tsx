import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AppleCard } from "@/components/ui/apple-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileUploader } from "@/components/FileUploader";
import { SecureFileLink } from "@/components/SecureFileLink";
import { SoftwareTabPanel, softwareFormDialogClass, confirmEntityDelete } from "@/components/software-dev";
import { TabSectionHeader } from "../TabSectionHeader";
import { Pencil, Plus, Trash2 } from "lucide-react";

const DOC_CATEGORIES = [
  { value: "pdf_drawing", label: "PDF Drawing" },
  { value: "autocad", label: "AutoCAD" },
  { value: "image", label: "Image" },
  { value: "render", label: "Render" },
  { value: "video", label: "Video" },
  { value: "floor_plan", label: "Floor Plan" },
  { value: "design_2d", label: "2D Design" },
  { value: "design_3d", label: "3D Design" },
  { value: "document", label: "Document" },
  { value: "other", label: "Other" },
] as const;

type DocCategory = (typeof DOC_CATEGORIES)[number]["value"];

type DocForm = {
  title: string;
  description: string;
  category: DocCategory;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

const emptyForm = (): DocForm => ({
  title: "",
  description: "",
  category: "other",
  fileUrl: "",
  fileName: "",
  fileType: "",
  fileSize: 0,
});

function DocumentFormFields({
  form,
  setForm,
}: {
  form: DocForm;
  setForm: React.Dispatch<React.SetStateAction<DocForm>>;
}) {
  return (
    <>
      <div className="space-y-1">
        <Label>Title *</Label>
        <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} required />
      </div>
      <div className="space-y-1">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          rows={2}
          placeholder="Optional notes about this file"
        />
      </div>
      <div className="space-y-1">
        <Label>Category</Label>
        <Select value={form.category} onValueChange={(v: DocCategory) => setForm((prev) => ({ ...prev, category: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {DOC_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>File *</Label>
        <FileUploader
          folder="architecture"
          mode="architecture"
          value={form.fileUrl}
          onChange={(url, meta) => setForm((prev) => ({
            ...prev,
            fileUrl: url,
            fileName: meta?.fileName || prev.fileName || "file",
            fileType: meta?.mimeType || prev.fileType || "application/octet-stream",
            fileSize: meta?.fileSize ?? prev.fileSize,
          }))}
        />
      </div>
    </>
  );
}

export default function DocumentsTab({ canManage }: { canManage: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<DocForm>(emptyForm);
  const [form, setForm] = useState<DocForm>(emptyForm);

  const { data, refetch } = trpc.architectureDocument.list.useQuery({ page: 1, limit: 50 });

  const createDoc = trpc.architectureDocument.create.useMutation({
    onSuccess: () => {
      toast.success("Document uploaded");
      setShowForm(false);
      setForm(emptyForm());
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateDoc = trpc.architectureDocument.update.useMutation({
    onSuccess: () => {
      toast.success("Document updated");
      setEditId(null);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteDoc = trpc.architectureDocument.delete.useMutation({
    onSuccess: () => {
      toast.success("Document deleted");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const openEdit = (doc: {
    id: number;
    title: string;
    description?: string | null;
    category: string;
    fileUrl: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  }) => {
    setEditId(doc.id);
    setEditForm({
      title: doc.title,
      description: doc.description || "",
      category: doc.category as DocCategory,
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
    });
  };

  return (
    <SoftwareTabPanel>
      <TabSectionHeader
        title="Documents & Files"
        description="Drawings, floor plans, renders, AutoCAD files, and project attachments."
        actions={canManage ? (
          <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setForm(emptyForm()); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Upload Document</Button>
            </DialogTrigger>
            <DialogContent className={softwareFormDialogClass}>
              <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!form.fileUrl) { toast.error("Please upload a file"); return; }
                  createDoc.mutate({
                    title: form.title,
                    description: form.description || undefined,
                    category: form.category,
                    fileUrl: form.fileUrl,
                    fileName: form.fileName,
                    fileType: form.fileType,
                    fileSize: form.fileSize,
                  });
                }}
                className="space-y-3"
              >
                <DocumentFormFields form={form} setForm={setForm} />
                <Button type="submit" disabled={createDoc.isPending}>Save Document</Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : undefined}
      />

      {!data?.items.length ? (
        <EmptyState title="No documents" description={canManage ? "Upload drawings, plans, renders, and project files." : "No documents uploaded yet."} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.items.map((doc) => (
            <AppleCard key={doc.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate">{doc.title}</h3>
                  <p className="text-sm text-muted-foreground capitalize">{doc.category.replace(/_/g, " ")}</p>
                  {doc.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{doc.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 truncate">{doc.fileName}</p>
                  <SecureFileLink url={doc.fileUrl} label="View / Download" className="text-sm text-primary mt-2 inline-block" />
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(doc)} aria-label="Edit document">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      aria-label="Delete document"
                      onClick={() => {
                        if (confirmEntityDelete(doc, "document")) deleteDoc.mutate({ id: doc.id });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </AppleCard>
          ))}
        </div>
      )}

      <Dialog open={editId !== null} onOpenChange={(open) => !open && setEditId(null)}>
        <DialogContent className={softwareFormDialogClass}>
          <DialogHeader><DialogTitle>Edit Document</DialogTitle></DialogHeader>
          {editId !== null && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editForm.fileUrl) { toast.error("Please upload a file"); return; }
                updateDoc.mutate({
                  id: editId,
                  title: editForm.title,
                  description: editForm.description || undefined,
                  category: editForm.category,
                  fileUrl: editForm.fileUrl,
                  fileName: editForm.fileName,
                  fileType: editForm.fileType,
                  fileSize: editForm.fileSize,
                });
              }}
              className="space-y-3"
            >
              <DocumentFormFields form={editForm} setForm={setEditForm} />
              <div className="flex gap-2">
                <Button type="submit" disabled={updateDoc.isPending}>Save Changes</Button>
                <Button type="button" variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </SoftwareTabPanel>
  );
}
