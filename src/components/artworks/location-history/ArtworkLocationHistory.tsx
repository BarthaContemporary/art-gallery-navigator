
import React from 'react';
import { useArtworkLocationHistory } from '@/hooks/use-artwork-location-history';
import { LocationHistoryCard } from './LocationHistoryCard';
import { Skeleton } from '@/components/ui/skeleton';

interface ArtworkLocationHistoryProps {
  artworkId: string;
}

export function ArtworkLocationHistory({ artworkId }: ArtworkLocationHistoryProps) {
  const { data: history, isLoading, error } = useArtworkLocationHistory(artworkId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6 text-red-500">
        <p>Error loading location history</p>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <p>No location history available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((record) => (
        <LocationHistoryCard key={record.id} record={record} />
      ))}
    </div>
  );
}
