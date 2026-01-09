import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Edit, Trash2, Mail, Phone, MapPin, ExternalLink, Globe } from "lucide-react";
import { useCRMOrganization, useDeleteCRMOrganization } from "@/hooks/crm";
import { OrganizationDialog } from "@/components/crm/organizations/OrganizationDialog";
import { OrganizationContactsSection } from "@/components/crm/organizations/OrganizationContactsSection";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CRMOrganizationType } from "@/types/crm";

const organizationTypeLabels: Record<CRMOrganizationType, string> = {
  gallery: "Gallery",
  museum: "Museum",
  foundation: "Foundation",
  fair: "Fair",
  press: "Press",
  corporation: "Corporation",
  auction_house: "Auction House",
  interior_designer: "Interior Designer",
  other: "Other",
};

export default function OrganizationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: organization, isLoading } = useCRMOrganization(id);
  const deleteOrganization = useDeleteCRMOrganization();

  const handleDelete = () => {
    if (organization && confirm("Delete this organization?")) {
      deleteOrganization.mutate(organization.id, {
        onSuccess: () => navigate("/crm/organizations"),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Organization not found</p>
        <Button variant="link" onClick={() => navigate("/crm/organizations")}>
          Back to organizations
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/crm/organizations")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{organization.name}</h1>
            <Badge variant="outline" className="mt-1">
              {organizationTypeLabels[organization.type] || organization.type}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2 ml-12 sm:ml-0">
          <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Organization Info */}
        <div className="space-y-6">
          {/* Contact Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organization Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {organization.email && (
                <a
                  href={`mailto:${organization.email}`}
                  className="flex items-center gap-2 text-sm hover:text-primary"
                >
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {organization.email}
                </a>
              )}
              {organization.phone && (
                <a
                  href={`tel:${organization.phone}`}
                  className="flex items-center gap-2 text-sm hover:text-primary"
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {organization.phone}
                </a>
              )}
              {organization.website && (
                <a
                  href={organization.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:text-primary"
                >
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  {organization.website}
                </a>
              )}
              
              {/* Address */}
              {(organization.address_line1 || organization.city || organization.country) && (
                <div className="pt-2 border-t">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="text-sm">
                      {organization.address_line1 && <p>{organization.address_line1}</p>}
                      {organization.address_line2 && <p>{organization.address_line2}</p>}
                      <p>
                        {[organization.city, organization.state, organization.postal_code]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      {organization.country && <p>{organization.country}</p>}
                    </div>
                  </div>
                  {(organization.address_line1 || organization.city) && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        [
                          organization.address_line1,
                          organization.city,
                          organization.state,
                          organization.postal_code,
                          organization.country,
                        ]
                          .filter(Boolean)
                          .join(", ")
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View on Map
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Business Details */}
          {(organization.vat_number || organization.eori_number || organization.company_number) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Business Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {organization.vat_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">VAT Number</span>
                    <span>{organization.vat_number}</span>
                  </div>
                )}
                {organization.eori_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">EORI Number</span>
                    <span>{organization.eori_number}</span>
                  </div>
                )}
                {organization.company_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Company Number</span>
                    <span>{organization.company_number}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {organization.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{organization.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Contacts */}
        <div className="lg:col-span-2">
          <OrganizationContactsSection organizationId={organization.id} />
        </div>
      </div>

      {/* Edit Dialog */}
      <OrganizationDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        organization={organization}
      />
    </div>
  );
}
