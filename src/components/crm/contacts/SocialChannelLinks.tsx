import { CRMContact } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { ExternalLink, Mail, Copy } from "lucide-react";
import { toast } from "sonner";

interface SocialChannelLinksProps { contact: CRMContact; }

export function SocialChannelLinks({ contact }: SocialChannelLinksProps) {
  const links = [
    { label: "Gmail", available: !!contact.email, href: `https://mail.google.com/mail/?view=cm&to=${contact.email}`, icon: Mail },
    { label: "Instagram", available: !!contact.instagram_handle, href: `https://instagram.com/${contact.instagram_handle?.replace("@", "")}` },
    { label: "LinkedIn", available: !!contact.linkedin_handle, href: `https://linkedin.com/in/${contact.linkedin_handle}` },
    { label: "WhatsApp", available: !!contact.whatsapp_number, href: `https://wa.me/${contact.whatsapp_number?.replace(/\D/g, "")}` },
  ];

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <div className="space-y-2">
      {links.filter(l => l.available).map((link) => (
        <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:text-primary">
          <ExternalLink className="h-3 w-3" />{link.label}
        </a>
      ))}
      {contact.line_id && (
        <Button variant="ghost" size="sm" className="h-auto p-0 text-sm" onClick={() => copyToClipboard(contact.line_id!, "LINE ID")}>
          <Copy className="h-3 w-3 mr-1" />LINE: {contact.line_id}
        </Button>
      )}
      {contact.wechat_id && (
        <Button variant="ghost" size="sm" className="h-auto p-0 text-sm" onClick={() => copyToClipboard(contact.wechat_id!, "WeChat ID")}>
          <Copy className="h-3 w-3 mr-1" />WeChat: {contact.wechat_id}
        </Button>
      )}
      {links.every(l => !l.available) && !contact.line_id && !contact.wechat_id && (
        <p className="text-sm text-muted-foreground">No social channels</p>
      )}
    </div>
  );
}
