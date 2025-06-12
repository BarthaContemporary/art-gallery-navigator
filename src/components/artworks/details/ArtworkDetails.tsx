
import React from "react";
import { Artwork } from "@/hooks/use-artworks";
import { Artist } from "@/hooks/use-artist";
import { Location } from "@/hooks/use-locations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, MapPin, Palette, DollarSign } from "lucide-react";

interface ArtworkDetailsProps {
  artwork: Artwork;
  artist: Artist | null | undefined;
  artistLoading: boolean;
  location: Location | null | undefined;
  locationLoading: boolean;
}

export function ArtworkDetails({
  artwork,
  artist,
  artistLoading,
  location,
  locationLoading,
}: ArtworkDetailsProps) {
  const formatDimensions = () => {
    const parts = [];
    if (artwork.height) parts.push(`H: ${artwork.height}`);
    if (artwork.width) parts.push(`W: ${artwork.width}`);
    if (artwork.depth) parts.push(`D: ${artwork.depth}`);
    return parts.length > 0 ? parts.join(" × ") : "Not specified";
  };

  const formatPrice = () => {
    if (!artwork.price) return null;
    return `${artwork.currency} ${artwork.price.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {artwork.medium_type}
          </Badge>
          <Badge variant={artwork.status === 'available' ? 'default' : 'secondary'} className="capitalize">
            {artwork.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Year: {artwork.year || "Unknown"}</span>
            </div>
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>
                Location: {locationLoading ? "Loading..." : location?.name || "Not specified"}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <Palette className="h-4 w-4" />
              <span>Medium: {artwork.medium_type}</span>
            </div>
          </div>

          <div className="space-y-3">
            {formatPrice() && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>{formatPrice()}</span>
              </div>
            )}
            
            <div>
              <span className="text-muted-foreground">Dimensions: </span>
              <span>{formatDimensions()}</span>
            </div>
            
            <div>
              <span className="text-muted-foreground">Classification: </span>
              <span>{artwork.classification}</span>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Tabbed Content */}
      <Tabs defaultValue="materials" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="provenance">History</TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="space-y-4 mt-4">
          <div>
            <h4 className="font-medium mb-2">Materials</h4>
            <p className="text-sm text-muted-foreground">
              {artwork.materials || "Not specified"}
            </p>
          </div>
          
          {artwork.condition && (
            <div>
              <h4 className="font-medium mb-2">Condition</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {artwork.condition}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="details" className="space-y-4 mt-4">
          {artwork.classification !== "Unique" && (
            <div>
              <h4 className="font-medium mb-2">Edition Information</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Edition Size: {artwork.edition_size || "N/A"}</p>
                <p>Available Works: {artwork.available_works || "N/A"}</p>
                <p>Artist Proofs: {artwork.artist_proofs || 0}</p>
              </div>
            </div>
          )}
          
          {artwork.signature_type && (
            <div>
              <h4 className="font-medium mb-2">Signature</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Type: {artwork.signature_type}</p>
                {artwork.signature_details && (
                  <p className="whitespace-pre-wrap">{artwork.signature_details}</p>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="provenance" className="space-y-4 mt-4">
          {artwork.provenance && (
            <div>
              <h4 className="font-medium mb-2">Provenance</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {artwork.provenance}
              </p>
            </div>
          )}
          
          {artwork.exhibition_history && (
            <div>
              <h4 className="font-medium mb-2">Exhibition History</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {artwork.exhibition_history}
              </p>
            </div>
          )}
          
          {artwork.story && (
            <div>
              <h4 className="font-medium mb-2">Story / Notes</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {artwork.story}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
