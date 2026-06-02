import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { AppleCard } from "@/components/ui/apple-card";
import { OniLoader } from "@/components/ui/oni-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Eye, Download, Upload, History } from "lucide-react";

const DOC_TYPES = [
  { value: "requirements", label: "Requirements" },
  { value: "design", label: "Design" },
  { value: "technical", label: "Technical" },
  { value: "user_manual", label: "User Manual" },
  { value: "api_doc", label: "API Documentation" },
  { value: "contract", label: "Contract" },
  { value: "proposal", label: "Proposal" },
  { value: "report", label: "Report" },
  { value: "other", label: "Other" },
];

export default function SoftwareDocuments() {
  const [viewDoc, setViewDoc] = useState<any>(null);
  const [showVersions, setShowVersions] = useState<any>(null);
  const [uploadDialog, setUploadDialog] = useState(false);

  const { data, isLoading } = trpc.softwareDocument.list.useQuery({ page: 1, limit: 50 });
  const { data: stats } = trpc.softwareDocument.stats.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <OniLoader size="lg" text="Loading documents..." />
      </div>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        title="Documents"
        description="Manage software development documents"
        icon={<FileText className="h-5 w-5" />}
        actions={
          <Button onClick={() => setUploadDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <AppleCard className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold">{stats?.total || 0}</p>
          </div>
        </AppleCard>
        <AppleCard className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
            <FileText className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Requirements</p>
            <p className="text-lg font-bold">{stats?.requirements || 0}</p>
          </div>
        </AppleCard>
        <AppleCard className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center">
            <FileText className="h-4 w-4 text-purple-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Technical</p>
            <p className="text-lg font-bold">{stats?.technical || 0}</p>
          </div>
        </AppleCard>
        <AppleCard className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
            <FileText className="h-4 w-4 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">User Manuals</p>
            <p className="text-lg font-bold">{stats?.userManuals || 0}</p>
          </div>
        </AppleCard>
      </div>

      {/* Documents Table */}
      <AppleCard>
        {data?.items && data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 font-medium">Title</th>
                  <th className="text-left py-3 px-4 font-medium">Type</th>
                  <th className="text-left py-3 px-4 font-medium">Version</th>
                  <th className="text-left py-3 px-4 font-medium">Project</th>
                  <th className="text-left py-3 px-4 font-medium">Updated</th>
                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((doc: any) => (
                  <tr key={doc.id} className="border-b border-border/30 hover:bg-accent/50">
                    <td className="py-3 px-4">
                      <div className="font-medium">{doc.title}</div>
                      <div className="text-xs text-muted-foreground">{doc.fileName}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                        {DOC_TYPES.find(t => t.value === doc.documentType)?.label || doc.documentType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">v{doc.version}</td>
                    <td className="py-3 px-4">{doc.projectName || "-"}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{doc.updatedAt}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewDoc(doc)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setShowVersions(doc)}>
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No documents found"
            description="Upload project requirements, design documents, and technical specifications."
            icon={FileText}
          />
        )}
      </AppleCard>

      {/* View Document Dialog */}
      <Dialog open={!!viewDoc} onOpenChange={() => setViewDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewDoc?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">File Name:</span>
              <span>{viewDoc?.fileName}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Type:</span>
              <span>{DOC_TYPES.find(t => t.value === viewDoc?.documentType)?.label || viewDoc?.documentType}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Version:</span>
              <span className="font-mono">v{viewDoc?.version}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">File Size:</span>
              <span>{viewDoc?.fileSize ? `${(viewDoc.fileSize / 1024).toFixed(1)} KB` : "-"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Mime Type:</span>
              <span>{viewDoc?.mimeType || "-"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Project:</span>
              <span>{viewDoc?.projectName || "-"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Created:</span>
              <span>{viewDoc?.createdAt}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Updated:</span>
              <span>{viewDoc?.updatedAt}</span>
            </div>
            {viewDoc?.description && (
              <div className="pt-2">
                <span className="text-muted-foreground block mb-1">Description:</span>
                <p className="text-muted-foreground">{viewDoc.description}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={!!showVersions} onOpenChange={() => setShowVersions(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Version History - {showVersions?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {showVersions?.versions?.map((v: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-accent/50">
                <div>
                  <div className="font-medium text-sm">Version {v.version}</div>
                  <div className="text-xs text-muted-foreground">{v.createdAt}</div>
                  {v.changeNotes && (
                    <div className="text-xs text-muted-foreground mt-1">{v.changeNotes}</div>
                  )}
                </div>
                <Button variant="ghost" size="sm">
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            )) || (
              <EmptyState
                title="No version history"
                description="This document has no previous versions."
                icon={History}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <input
                type="text"
                placeholder="Document title"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Document Type</label>
              <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {DOC_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Project (Optional)</label>
              <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">No Project</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">File</label>
              <div className="mt-1 border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Drag and drop or click to browse</p>
              </div>
            </div>
            <Button className="w-full">Upload</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
