
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Clock } from "lucide-react";

interface ClientBadgesProps {
  status: string;
  cmSyncStatus?: string;
  tags?: string[];
}

export function ClientBadges({ status, cmSyncStatus, tags }: ClientBadgesProps) {
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

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'synced': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'synced': return <CheckCircle className="h-3 w-3" />;
      case 'error': return <AlertCircle className="h-3 w-3" />;
      case 'pending': return <Clock className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Badge className={getStatusColor(status)}>
        {status}
      </Badge>
      {cmSyncStatus && (
        <Badge className={getSyncStatusColor(cmSyncStatus)} variant="outline">
          {getSyncStatusIcon(cmSyncStatus)}
          <span className="ml-1 text-xs">CM</span>
        </Badge>
      )}
      {tags && tags.length > 0 && (
        <div className="flex gap-1">
          {tags.slice(0, 2).map((tag: string, index: number) => (
            <Badge key={index} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {tags.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{tags.length - 2}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
