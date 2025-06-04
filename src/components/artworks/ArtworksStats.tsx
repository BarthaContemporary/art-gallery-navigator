
interface ArtworksStatsProps {
  filteredCount: number;
  totalCount: number;
  useVirtualization: boolean;
}

export function ArtworksStats({ 
  filteredCount, 
  totalCount, 
  useVirtualization 
}: ArtworksStatsProps) {
  return (
    <div className="mb-4 text-sm text-muted-foreground">
      Showing {filteredCount} of {totalCount} artworks
      {filteredCount > 100 && !useVirtualization && (
        <span className="ml-2 text-amber-600">
          • Consider enabling virtualization for better performance
        </span>
      )}
    </div>
  );
}
