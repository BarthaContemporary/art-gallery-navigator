
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArtworkLocationHistory } from '../location-history/ArtworkLocationHistory';
import { ArtworkDocuments } from '../documents/ArtworkDocuments';
import { MapPin, FileText, Info } from 'lucide-react';
import { ArtworkOverviewPrimaryInfo } from './ArtworkOverviewPrimaryInfo';
import { ArtworkOverviewCollapsibleInfo } from './ArtworkOverviewCollapsibleInfo';
import { Artwork } from '@/hooks/use-artworks';
import { Artist } from '@/hooks/useArtists';
import { Location } from '@/hooks/use-locations';

interface ArtworkOverviewTabsProps {
  artwork: Artwork;
  artist: Artist | null | undefined;
  artistLoading: boolean;
  location: Location | null | undefined;
  locationLoading: boolean;
}

export function ArtworkOverviewTabs({
  artwork,
  artist,
  artistLoading,
  location,
  locationLoading,
}: ArtworkOverviewTabsProps) {
  return (
    <Tabs defaultValue="details" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="details" className="flex items-center gap-2">
          <Info className="h-4 w-4" />
          Details
        </TabsTrigger>
        <TabsTrigger value="location-history" className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Location History
        </TabsTrigger>
        <TabsTrigger value="documents" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Documents
        </TabsTrigger>
      </TabsList>

      <TabsContent value="details" className="mt-6 space-y-6">
        <ArtworkOverviewPrimaryInfo 
          artwork={artwork} 
          artist={artist} 
          artistLoading={artistLoading} 
        />
        <ArtworkOverviewCollapsibleInfo 
          artwork={artwork} 
          location={location}
          locationLoading={locationLoading}
        />
      </TabsContent>

      <TabsContent value="location-history" className="mt-6">
        <ArtworkLocationHistory artworkId={artwork.id} />
      </TabsContent>

      <TabsContent value="documents" className="mt-6">
        <ArtworkDocuments artworkId={artwork.id} />
      </TabsContent>
    </Tabs>
  );
}
