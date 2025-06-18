
import { Building2, Tag, Calendar } from "lucide-react";
import { format } from "date-fns";

interface ClientProfessionalSectionProps {
  client: any;
}

export function ClientProfessionalSection({ client }: ClientProfessionalSectionProps) {
  return (
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
  );
}
