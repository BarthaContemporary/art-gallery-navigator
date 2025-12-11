import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Calendar, MapPin, Globe, User } from "lucide-react";

interface ArtistInfoPanelProps {
  artist: {
    id: string;
    full_name: string;
    nationality?: string;
    birth_year?: number;
    death_year?: number;
    place_of_birth?: string;
    place_of_death?: string;
    biography?: string;
    representation_status?: string;
    image_url?: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArtistInfoPanel({ artist, open, onOpenChange }: ArtistInfoPanelProps) {
  // Placeholder for future API data
  const [isLoadingExternalData, setIsLoadingExternalData] = useState(false);
  const [externalData, setExternalData] = useState<{
    wikipedia?: string;
    artsy?: string;
    exhibitions?: string[];
    awards?: string[];
  } | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {artist.full_name}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(85vh-100px)] pr-4">
          <div className="space-y-6">
            {/* Basic Info Section */}
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Basic Information
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                {artist.nationality && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span>{artist.nationality}</span>
                  </div>
                )}
                
                {(artist.birth_year || artist.death_year) && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {artist.birth_year && `b. ${artist.birth_year}`}
                      {artist.birth_year && artist.death_year && " – "}
                      {artist.death_year && `d. ${artist.death_year}`}
                    </span>
                  </div>
                )}
                
                {artist.place_of_birth && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>Born: {artist.place_of_birth}</span>
                  </div>
                )}
                
                {artist.place_of_death && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>Died: {artist.place_of_death}</span>
                  </div>
                )}
              </div>
              
              {artist.representation_status && (
                <Badge variant="outline" className="mt-2">
                  {artist.representation_status}
                </Badge>
              )}
            </section>
            
            <Separator />
            
            {/* Biography Section */}
            {artist.biography && (
              <>
                <section className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Biography
                  </h3>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {artist.biography}
                  </p>
                </section>
                <Separator />
              </>
            )}
            
            {/* External Data Section - Placeholder for API integration */}
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                External Sources
              </h3>
              
              {isLoadingExternalData ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground italic">
                    External data sources will be integrated here.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Wikipedia (coming soon)
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Artsy (coming soon)
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Artnet (coming soon)
                    </Badge>
                  </div>
                </div>
              )}
            </section>
            
            {/* Exhibitions Section - Placeholder */}
            <Separator />
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Exhibition History
              </h3>
              <p className="text-sm text-muted-foreground italic">
                Exhibition data will be populated from external APIs.
              </p>
            </section>
            
            {/* Market Data Section - Placeholder */}
            <Separator />
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Market Information
              </h3>
              <p className="text-sm text-muted-foreground italic">
                Auction results and market data will appear here.
              </p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
