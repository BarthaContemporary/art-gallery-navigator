
import React from 'react';
import { format } from 'date-fns';
import { MapPin, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ArtworkLocationHistory } from '@/hooks/use-artwork-location-history';

interface LocationHistoryCardProps {
  record: ArtworkLocationHistory;
}

export function LocationHistoryCard({ record }: LocationHistoryCardProps) {
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
  };

  const getLocationName = (location: { name: string } | null | undefined) => {
    return location?.name || 'Unknown Location';
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <MapPin className="h-4 w-4 text-gray-500" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {record.previous_location_id && (
                <>
                  <span className="text-sm font-medium text-gray-700">
                    {getLocationName(record.previous_location)}
                  </span>
                  <ArrowRight className="h-3 w-3 text-gray-400" />
                </>
              )}
              <span className="text-sm font-medium text-gray-900">
                {record.location_id ? getLocationName(record.location) : 'Removed from location'}
              </span>
            </div>
            
            <div className="mt-1 text-xs text-gray-500">
              {formatDate(record.changed_at)}
            </div>
            
            {record.notes && (
              <div className="mt-2 text-sm text-gray-600">
                {record.notes}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
