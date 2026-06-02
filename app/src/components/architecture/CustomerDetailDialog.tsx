import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppleCard } from "@/components/ui/apple-card";
import { Button } from "@/components/ui/button";
import { OniLoader } from "@/components/ui/oni-loader";
import { softwareFormDialogClass } from "@/components/software-dev";
import { toast } from "sonner";
import { MapPin, Mail, Phone, User, Copy, ExternalLink } from "lucide-react";

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b border-border/40 py-2.5 last:border-0 sm:grid-cols-[140px_1fr] sm:gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium break-words">{value}</span>
    </div>
  );
}

interface CustomerDetailDialogProps {
  customerId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerDetailDialog({ customerId, open, onOpenChange }: CustomerDetailDialogProps) {
  const { data: customer, isLoading } = trpc.architectureCustomer.getById.useQuery(
    { id: customerId! },
    { enabled: open && customerId != null }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${softwareFormDialogClass} max-w-xl`}>
        <DialogHeader>
          <DialogTitle>{customer?.fullName || "Customer Details"}</DialogTitle>
          {customer?.customerId && <p className="text-sm text-muted-foreground">{customer.customerId}</p>}
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><OniLoader text="Loading customer" /></div>
        ) : !customer ? (
          <p className="text-sm text-muted-foreground">Customer not found.</p>
        ) : (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <AppleCard hover={false} className="p-4">
              <div className="mb-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Mail className="h-4 w-4" />{customer.email}</span>
                <span className="inline-flex items-center gap-1"><Phone className="h-4 w-4" />{customer.phone}</span>
              </div>
              <DetailRow label="Alt. Phone" value={customer.alternatePhone} />
              <DetailRow label="Country" value={customer.country} />
              <DetailRow label="State" value={customer.state} />
              <DetailRow label="City" value={customer.city} />
              <DetailRow label="Address" value={customer.address} />
              <DetailRow label="Postal Code" value={customer.postalCode} />
              <DetailRow label="Map Location" value={customer.mapLocation} />
              <DetailRow label="Notes" value={customer.notes} />
              <DetailRow label="Created" value={customer.createdAt ? new Date(customer.createdAt).toLocaleString() : undefined} />
            </AppleCard>

            {customer.portalToken && (
              <AppleCard hover={false} className="p-4">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold"><User className="h-4 w-4" /> Customer Portal</h4>
                <p className="mb-3 break-all text-xs text-muted-foreground">
                  {typeof window !== "undefined" ? `${window.location.origin}/portal/architecture/${customer.portalToken}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => {
                      const url = `${window.location.origin}/portal/architecture/${customer.portalToken}`;
                      navigator.clipboard.writeText(url);
                      toast.success("Portal link copied");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy Link
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" asChild>
                    <a href={`/portal/architecture/${customer.portalToken}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> Open Portal
                    </a>
                  </Button>
                </div>
              </AppleCard>
            )}

            {customer.mapLocation && (
              <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                Google Map: {customer.mapLocation}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
