
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Calendar, Globe, Instagram, Linkedin, Tag, User, Copy, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ClientProfileImage } from "./ClientProfileImage";
import { ContactActions } from "./ContactActions";
import { AddressMap } from "./AddressMap";
import { toast } from "sonner";

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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-3">
            <ClientProfileImage
              fullName={client.full_name}
              instagramHandle={client.instagram_handle}
              linkedinHandle={client.linkedin_handle}
              size="lg"
            />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xl font-semibold">{client.full_name}</span>
                <Badge className={getStatusColor(client.status)}>
                  {client.status}
                </Badge>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span className="capitalize">{client.client_type}</span>
                </div>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact Information - Left Column */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground border-b pb-1">
              Contact Information
            </h3>
            
            {client.email && (
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-sm truncate">{client.email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(client.email, 'Email')}
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <ContactActions email={client.email} />
              </div>
            )}
            
            {client.phone && (
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-sm truncate">{client.phone}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(client.phone, 'Phone')}
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <ContactActions phone={client.phone} />
              </div>
            )}

            {client.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <a 
                  href={client.website} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1 truncate"
                >
                  <span className="truncate">{client.website}</span>
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              </div>
            )}

            {/* Social Media - Compact */}
            {(client.instagram_handle || client.linkedin_handle) && (
              <div className="space-y-2">
                {client.instagram_handle && (
                  <div className="flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a 
                      href={`https://instagram.com/${client.instagram_handle.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {client.instagram_handle}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {client.linkedin_handle && (
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a 
                      href={client.linkedin_handle.startsWith('http') ? client.linkedin_handle : `https://${client.linkedin_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      LinkedIn
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Professional & Details - Middle Column */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground border-b pb-1">
              Professional Details
            </h3>
            
            {client.company && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm">{client.company}</span>
              </div>
            )}

            {client.source && (
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm">Source: {client.source}</span>
              </div>
            )}

            {client.birthday && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm">Birthday: {format(new Date(client.birthday), 'MMM d, yyyy')}</span>
              </div>
            )}

            {/* Activity Info - Compact */}
            <div className="pt-2 border-t space-y-1">
              <div className="text-xs text-muted-foreground">
                Created: {format(new Date(client.created_at), 'MMM d, yyyy')}
              </div>
              {client.last_activity_date && (
                <div className="text-xs text-muted-foreground">
                  Last Activity: {format(new Date(client.last_activity_date), 'MMM d, yyyy')}
                </div>
              )}
            </div>
          </div>

          {/* Address & Map - Right Column */}
          <div className="space-y-4">
            {client.address && (
              <>
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground border-b pb-1">
                  Location
                </h3>
                <AddressMap address={client.address} clientName={client.full_name} />
              </>
            )}
          </div>
        </div>

        {/* Tags & Artists - Full Width Bottom Section */}
        {((client.interested_artists && client.interested_artists.length > 0) || 
          (client.tags && client.tags.length > 0)) && (
          <div className="pt-4 border-t space-y-4">
            {client.interested_artists && client.interested_artists.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">
                  Interested Artists
                </h3>
                <div className="flex flex-wrap gap-1">
                  {client.interested_artists.map((artist: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs px-2 py-1">
                      {artist}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {client.tags && client.tags.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-1">
                  {client.tags.map((tag: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs px-2 py-1">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notes - Full Width */}
        {client.notes && (
          <div className="pt-4 border-t">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">
              Notes
            </h3>
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {client.notes}
            </p>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
