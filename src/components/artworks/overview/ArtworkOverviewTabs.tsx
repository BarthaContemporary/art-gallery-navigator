
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArtworkLocationHistory } from '../location-history/ArtworkLocationHistory';
import { MapPin, Info, Sparkles } from 'lucide-react';
import { ArtworkOverviewPrimaryInfo } from './ArtworkOverviewPrimaryInfo';
import { ArtworkOverviewCollapsibleInfo } from './ArtworkOverviewCollapsibleInfo';
import { ArtworkAIDescriptionTab } from './ArtworkAIDescriptionTab';
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
      <TabsList className="inline-flex h-8 items-center justify-start rounded-lg bg-muted/30 p-1 text-muted-foreground w-fit">
        <TabsTrigger 
          value="details" 
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-1.5"
        >
          <Info className="h-3 w-3" />
          Details
        </TabsTrigger>
        <TabsTrigger 
          value="ai-description" 
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-1.5"
        >
          <Sparkles className="h-3 w-3" />
          AI Description
        </TabsTrigger>
        <TabsTrigger 
          value="location-history" 
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-1.5"
        >
          <MapPin className="h-3 w-3" />
          Location
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

      <TabsContent value="ai-description" className="mt-6">
        <ArtworkAIDescriptionTab artwork={artwork} />
      </TabsContent>

      <TabsContent value="location-history" className="mt-6">
        <ArtworkLocationHistory artworkId={artwork.id} />
      </TabsContent>

    </Tabs>
  );
}
