
import { Button } from "@/components/ui/button";
import { Globe, Instagram, Linkedin, Copy, ExternalLink, MapPin } from "lucide-react";
import { ContactActions } from "./ContactActions";
import { toast } from "sonner";

interface ClientContactSectionProps {
  client: any;
}

export function ClientContactSection({ client }: ClientContactSectionProps) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
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

      {client.address && (
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <span className="text-sm text-gray-700 leading-relaxed">{client.address}</span>
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
  );
}
