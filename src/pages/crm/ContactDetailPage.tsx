import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Edit, Trash2, Mail, Phone, MapPin, ExternalLink } from "lucide-react";
import { useCRMContact, useDeleteCRMContact } from "@/hooks/crm";
import { ContactDialog } from "@/components/crm/contacts/ContactDialog";
import { ContactTimeline } from "@/components/crm/contacts/ContactTimeline";
import { SocialChannelLinks } from "@/components/crm/contacts/SocialChannelLinks";
import { SanctionsCheckCard } from "@/components/crm/contacts/SanctionsCheckCard";
import { ContactOrganizationsSection } from "@/components/crm/contacts/ContactOrganizationsSection";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: contact, isLoading } = useCRMContact(id);
  const deleteContact = useDeleteCRMContact();

  const handleDelete = () => {
    if (contact && confirm("Delete this contact?")) {
      deleteContact.mutate(contact.id, {
        onSuccess: () => navigate("/crm"),
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

  if (!contact) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Contact not found</p>
        <Button variant="link" onClick={() => navigate("/crm")}>
          Back to contacts
        </Button>
      </div>
    );
  }

  const contactTypeLabels: Record<string, string> = {
    collector: "Collector",
    curator: "Curator",
    press: "Press",
    institution: "Institution",
    artist: "Artist",
    advisor: "Advisor",
    vip: "VIP",
    prospect: "Prospect",
    other: "Other",
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/crm")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          {/* Profile Image */}
          <Avatar className="h-16 w-16">
            <AvatarImage src={contact.profile_image_url} alt={contact.full_name} />
            <AvatarFallback className="text-lg">
              {getInitials(contact.full_name)}
            </AvatarFallback>
          </Avatar>
          
          <div>
            <h1 className="text-2xl font-semibold">{contact.full_name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline">
                {contactTypeLabels[contact.contact_type] || contact.contact_type}
              </Badge>
              {contact.job_title && (
                <span className="text-sm text-muted-foreground">
                  {contact.job_title}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
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

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Contact Info */}
        <div className="space-y-6">
          {/* Contact Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-2 text-sm hover:text-primary"
                >
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {contact.email}
                </a>
              )}
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-2 text-sm hover:text-primary"
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {contact.phone}
                </a>
              )}
              {/* Full Address Display */}
              {(contact.address_line1 || contact.city || contact.country) && (
                <div className="pt-2 border-t">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="text-sm">
                      {contact.address_line1 && <p>{contact.address_line1}</p>}
                      {contact.address_line2 && <p>{contact.address_line2}</p>}
                      <p>
                        {[contact.city, contact.state, contact.postal_code]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      {contact.country && <p>{contact.country}</p>}
                    </div>
                  </div>
                  {/* View on Map Link */}
                  {(contact.address_line1 || contact.city) && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        [
                          contact.address_line1,
                          contact.city,
                          contact.state,
                          contact.postal_code,
                          contact.country,
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

          {/* Organizations - Multiple */}
          <ContactOrganizationsSection contactId={contact.id} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Social Channels</CardTitle>
            </CardHeader>
            <CardContent>
              <SocialChannelLinks contact={contact} />
            </CardContent>
          </Card>

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {contact.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {contact.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Sanctions Check */}
          <SanctionsCheckCard contact={contact} />
        </div>

        {/* Right Column - Timeline */}
        <div className="col-span-2">
          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="lists">Lists</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="mt-4">
              <ContactTimeline contactId={contact.id} />
            </TabsContent>
            <TabsContent value="lists" className="mt-4">
              <Card>
                <CardContent className="py-6">
                  <p className="text-sm text-muted-foreground">
                    List membership will be shown here.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Dialog */}
      <ContactDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        contact={contact}
      />
    </div>
  );
}
