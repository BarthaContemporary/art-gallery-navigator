
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import { ClientProfileImage } from "./ClientProfileImage";

interface ClientDetailsHeaderProps {
  client: any;
}

export function ClientDetailsHeader({ client }: ClientDetailsHeaderProps) {
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
    <div className="flex items-center gap-3">
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
    </div>
  );
}
