
import { Button } from "@/components/ui/button";
import { Globe, Instagram, Linkedin, Copy, MapPin } from "lucide-react";
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

  const handleWhatsAppClick = () => {
    if (client.phone) {
      // Clean phone number for WhatsApp (remove spaces, hyphens, etc.)
      const cleanPhone = client.phone.replace(/[^\d+]/g, '');
      window.open(`https://wa.me/${cleanPhone}`, '_blank');
    }
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

      {(client.website || client.instagram_handle || client.linkedin_handle || client.phone) && (
        <div className="flex items-center gap-2">
          {client.phone && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleWhatsAppClick}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-green-600"
              title="WhatsApp"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
              </svg>
            </Button>
          )}
          {client.website && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600"
            >
              <a 
                href={client.website} 
                target="_blank" 
                rel="noopener noreferrer"
                title={client.website}
              >
                <Globe className="h-4 w-4" />
              </a>
            </Button>
          )}
          {client.instagram_handle && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-8 w-8 p-0 text-muted-foreground hover:text-pink-600"
            >
              <a 
                href={`https://instagram.com/${client.instagram_handle.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                title={client.instagram_handle}
              >
                <Instagram className="h-4 w-4" />
              </a>
            </Button>
          )}
          {client.linkedin_handle && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-700"
            >
              <a 
                href={client.linkedin_handle.startsWith('http') ? client.linkedin_handle : `https://${client.linkedin_handle}`}
                target="_blank"
                rel="noopener noreferrer"
                title="LinkedIn Profile"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
