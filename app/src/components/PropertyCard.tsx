import { Link } from "react-router";
import { MapPin, User, Phone, Building2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { ApprovalBadge } from "./ApprovalBadge";
import { StepBadge } from "./ApprovalBadge";
import { cn, formatCurrency } from "@/lib/utils";

type ApprovalStatus = "draft" | "submitted" | "pending_review" | "approved" | "rejected" | "completed" | "cancelled";
type WorkflowStatus = "pending" | "processing" | "approved" | "rejected" | "completed" | "cancelled";

interface Property {
  id: number;
  propertyName: string;
  propertyTypeName?: string;
  address: string;
  ownerName: string;
  ownerPhone: string;
  ownerCID?: string;
  sellingPrice: string;
  realEstateFee?: string;
  currentStep: number;
  approvalStatus: ApprovalStatus;
  workflowStatus: WorkflowStatus;
  listedByName?: string;
  createdAt?: Date | string;
}

interface PropertyCardProps {
  property: Property;
  onEdit?: () => void;
  onView?: () => void;
  className?: string;
}

export function PropertyCard({ property, onView, className }: PropertyCardProps) {
  return (
    <Card className={cn("group hover:shadow-lg transition-all duration-300", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg line-clamp-1">{property.propertyName}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              {property.propertyTypeName || "Property"}
            </div>
          </div>
          <ApprovalBadge status={property.approvalStatus} showIcon />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          <span className="line-clamp-2 text-muted-foreground">{property.address}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{property.ownerName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{property.ownerPhone}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Selling Price</p>
            <p className="font-semibold text-lg">{formatCurrency(property.sellingPrice)}</p>
          </div>
          {property.realEstateFee && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Commission</p>
              <p className="font-medium text-primary">{formatCurrency(property.realEstateFee)}</p>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t bg-muted/30">
        <div className="flex items-center justify-between w-full">
          <StepBadge step={property.currentStep} currentStep={property.currentStep} isCompleted={false} />
          <div className="flex items-center gap-2">
            {onView && (
              <Button variant="outline" size="sm" onClick={onView}>
                View
              </Button>
            )}
            <Button variant="ghost" size="icon" asChild>
              <Link to={`/properties/${property.id}`}>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

interface PropertyListProps {
  properties: Property[];
  loading?: boolean;
  emptyMessage?: string;
}

export function PropertyList({ properties, loading, emptyMessage = "No properties found" }: PropertyListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-64 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
}
