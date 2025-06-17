
import { Mail, Phone } from "lucide-react";

interface ClientInfoProps {
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  cmSyncError?: string;
}

export function ClientInfo({ email, phone, company, notes, cmSyncError }: ClientInfoProps) {
  return (
    <div className="flex-1">
      <div className="flex flex-col sm:flex-row gap-2 text-sm text-muted-foreground">
        {email && (
          <div className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {email}
          </div>
        )}
        {phone && (
          <div className="flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {phone}
          </div>
        )}
        {company && (
          <div className="text-sm">
            {company}
          </div>
        )}
      </div>

      {notes && (
        <div className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium">Notes:</span> {notes.length > 100 ? `${notes.substring(0, 100)}...` : notes}
        </div>
      )}

      {cmSyncError && (
        <div className="mt-2 text-xs text-red-600">
          CM Sync Error: {cmSyncError}
        </div>
      )}
    </div>
  );
}
