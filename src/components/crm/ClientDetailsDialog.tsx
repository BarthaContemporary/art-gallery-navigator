
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Calendar, Globe, Instagram, Linkedin, Tag, User } from "lucide-react";
import { format } from "date-fns";
import { ClientProfileImage } from "./ClientProfileImage";
import { ContactActions } from "./ContactActions";
import { AddressMap } from "./AddressMap";

interface ClientDetailsDialogProps {
  client: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientDetailsDialog({ client, open, onOpenChange }: ClientDetailsDialogProps) {
  if (!client) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'customer': return 'bg-green-100 text-green-800';
      case 'prospect': return 'bg-yellow-100 text-yellow-800';
      case 'lead': return 'bg-blue-100 text-blue-800';
      case 'active': return 'bg-emerald-100 text-emerald-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-3">
            <ClientProfileImage
              fullName={client.full_name}
              instagramHandle={client.instagram_handle}
              linkedinHandle={client.linkedin_handle}
              size="lg"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl font-semibold">{client.full_name}</span>
                <Badge className={getStatusColor(client.status)}>
                  {client.status}
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="capitalize">{client.client_type}</span>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contact Information */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Contact</h3>
            
            {client.email && (
              <div className="flex items-center justify-between">
                <span className="text-sm">{client.email}</span>
                <ContactActions email={client.email} />
              </div>
            )}
            
            {client.phone && (
              <div className="flex items-center justify-between">
                <span className="text-sm">{client.phone}</span>
                <ContactActions phone={client.phone} />
              </div>
            )}

            {client.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-3 w-3 text-muted-foreground" />
                <a 
                  href={client.website} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sm text-blue-600 hover:underline"
                >
                  {client.website}
                </a>
              </div>
            )}

            {/* Social Media */}
            {(client.instagram_handle || client.linkedin_handle) && (
              <div className="space-y-2">
                {client.instagram_handle && (
                  <div className="flex items-center gap-2">
                    <Instagram className="h-3 w-3 text-muted-foreground" />
                    <a 
                      href={`https://instagram.com/${client.instagram_handle.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {client.instagram_handle}
                    </a>
                  </div>
                )}
                {client.linkedin_handle && (
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-3 w-3 text-muted-foreground" />
                    <a 
                      href={client.linkedin_handle.startsWith('http') ? client.linkedin_handle : `https://${client.linkedin_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      LinkedIn
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Professional Details */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Professional</h3>
            
            {client.company && (
              <div className="flex items-center gap-2">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm">{client.company}</span>
              </div>
            )}

            {client.source && (
              <div className="flex items-center gap-2">
                <Tag className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm">Source: {client.source}</span>
              </div>
            )}

            {client.birthday && (
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm">Birthday: {format(new Date(client.birthday), 'MMMM d, yyyy')}</span>
              </div>
            )}

            {/* Activity Info */}
            <div className="pt-2 border-t border-gray-100">
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Created: {format(new Date(client.created_at), 'MMM d, yyyy')}</div>
                {client.last_activity_date && (
                  <div>Last Activity: {format(new Date(client.last_activity_date), 'MMM d, yyyy')}</div>
                )}
              </div>
            </div>
          </div>

          {/* Address & Map */}
          {client.address && (
            <div className="md:col-span-2 space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Location</h3>
              <AddressMap address={client.address} clientName={client.full_name} />
            </div>
          )}

          {/* Interested Artists */}
          {client.interested_artists && client.interested_artists.length > 0 && (
            <div className="md:col-span-2 space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Interested Artists</h3>
              <div className="flex flex-wrap gap-1">
                {client.interested_artists.map((artist: string, index: number) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {artist}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {client.tags && client.tags.length > 0 && (
            <div className="md:col-span-2 space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Tags</h3>
              <div className="flex flex-wrap gap-1">
                {client.tags.map((tag: string, index: number) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {client.notes && (
            <div className="md:col-span-2 space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Notes</h3>
              <p className="text-sm text-gray-700 whitespace-pre-line">{client.notes}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
