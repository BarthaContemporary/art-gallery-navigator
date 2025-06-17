
import { Button } from "@/components/ui/button";
import { Edit, MoreHorizontal, RotateCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ClientActionsProps {
  client: any;
  onViewDetails: (client: any) => void;
  onEdit: (client: any) => void;
  onSync: (clientId: string) => void;
  isSyncing: boolean;
}

export function ClientActions({ client, onViewDetails, onEdit, onSync, isSyncing }: ClientActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onViewDetails(client)}
      >
        View Details
      </Button>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onEdit(client)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Client
          </DropdownMenuItem>
          {client.email && (
            <DropdownMenuItem 
              onClick={() => onSync(client.id)}
              disabled={isSyncing}
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Sync to Campaign Monitor
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
