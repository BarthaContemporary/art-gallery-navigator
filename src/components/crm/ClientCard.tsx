
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MoreVertical, 
  Eye, 
  Edit, 
  Trash2, 
  Mail, 
  Phone,
  Calendar,
  Building2,
  MapPin
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClientContactSection } from "./ClientContactSection";
import { ClientListDropdown } from "./ClientListDropdown";

interface ClientCardProps {
  client: any;
  onEdit: (client: any) => void;
  onDelete: (clientId: string) => void;
  onViewDetails: (client: any) => void;
  clientListIds?: string[];
}

export function ClientCard({ 
  client, 
  onEdit, 
  onDelete, 
  onViewDetails,
  clientListIds = []
}: ClientCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'customer':
        return 'bg-green-100 text-green-800';
      case 'prospect':
        return 'bg-yellow-100 text-yellow-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">{client.full_name}</h3>
            <div className="flex items-center gap-2 mb-2">
              <Badge className={getStatusColor(client.status)}>
                {client.status}
              </Badge>
              {client.client_type && (
                <Badge variant="outline">
                  {client.client_type}
                </Badge>
              )}
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewDetails(client)}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(client)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(client.id)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <ClientContactSection client={client} />

        {(client.company || client.source) && (
          <div className="mt-3 pt-3 border-t space-y-1">
            {client.company && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{client.company}</span>
              </div>
            )}
            {client.source && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Source: {client.source}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-3 pt-3 border-t">
          <ClientListDropdown 
            clientId={client.id} 
            clientListIds={clientListIds}
          />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onViewDetails(client)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
