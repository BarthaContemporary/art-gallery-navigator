
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Eye } from "lucide-react";

interface ClientItemProps {
  client: any;
  onEdit: (client: any) => void;
  onDelete: (clientId: string) => void;
  onViewDetails: (client: any) => void;
  getStatusColor: (status: string) => string;
}

export function ClientItem({ client, onEdit, onDelete, onViewDetails, getStatusColor }: ClientItemProps) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-4 flex-1">
        <div className="font-medium">{client.full_name}</div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(client.status)}`}>
          {client.status}
        </span>
        <div className="text-sm text-muted-foreground">{client.client_type}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewDetails(client)}
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(client)}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(client.id)}
          className="text-red-500 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
