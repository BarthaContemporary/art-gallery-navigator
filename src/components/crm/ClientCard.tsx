
import { Card, CardContent } from "@/components/ui/card";
import { ClientBadges } from "./ClientBadges";
import { ClientInfo } from "./ClientInfo";
import { ClientActions } from "./ClientActions";

interface ClientCardProps {
  client: any;
  onViewDetails: (client: any) => void;
  onEdit: (client: any) => void;
  onSync: (clientId: string) => void;
  isSyncing: boolean;
}

export function ClientCard({ client, onViewDetails, onEdit, onSync, isSyncing }: ClientCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-lg">{client.full_name}</h3>
              <ClientBadges 
                status={client.status}
                cmSyncStatus={client.cm_sync_status}
                tags={client.tags}
              />
            </div>

            <ClientInfo
              email={client.email}
              phone={client.phone}
              company={client.company}
              notes={client.notes}
              cmSyncError={client.cm_sync_error}
            />
          </div>

          <ClientActions
            client={client}
            onViewDetails={onViewDetails}
            onEdit={onEdit}
            onSync={onSync}
            isSyncing={isSyncing}
          />
        </div>
      </CardContent>
    </Card>
  );
}
