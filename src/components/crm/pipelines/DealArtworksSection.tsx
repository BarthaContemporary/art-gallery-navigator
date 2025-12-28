import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Palette, Search, Plus, X, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface DealArtworksSectionProps {
  dealId: string;
  relatedArtworks: string[];
  onUpdateArtworks: (artworkIds: string[]) => void;
}

interface Artwork {
  id: string;
  title: string;
  artist?: { full_name: string };
  year?: number;
  price?: number;
  currency?: string;
  primary_image?: { thumbnail_url: string; image_url: string };
}

export function DealArtworksSection({ dealId, relatedArtworks, onUpdateArtworks }: DealArtworksSectionProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch linked artworks details
  const { data: linkedArtworks = [] } = useQuery({
    queryKey: ['deal-artworks', relatedArtworks],
    queryFn: async () => {
      if (!relatedArtworks.length) return [];
      const { data, error } = await supabase
        .from('artworks')
        .select(`
          id, title, year, price, currency,
          artist:artists(full_name),
          primary_image:artwork_images(thumbnail_url, image_url)
        `)
        .in('id', relatedArtworks)
        .eq('artwork_images.is_primary', true);
      
      if (error) throw error;
      return data.map(a => ({
        ...a,
        artist: a.artist as { full_name: string } | null,
        primary_image: (a.primary_image as any[])?.[0] || null,
      })) as Artwork[];
    },
    enabled: relatedArtworks.length > 0,
  });

  // Search artworks for picker
  const { data: searchResults = [] } = useQuery({
    queryKey: ['artworks-search', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('artworks')
        .select(`
          id, title, year, price, currency,
          artist:artists(full_name),
          primary_image:artwork_images(thumbnail_url, image_url)
        `)
        .eq('artwork_images.is_primary', true)
        .order('created_at', { ascending: false })
        .limit(20);

      if (searchTerm) {
        query = query.ilike('title', `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data.map(a => ({
        ...a,
        artist: a.artist as { full_name: string } | null,
        primary_image: (a.primary_image as any[])?.[0] || null,
      })) as Artwork[];
    },
    enabled: isPickerOpen,
  });

  const handleAddArtwork = (artworkId: string) => {
    if (!relatedArtworks.includes(artworkId)) {
      onUpdateArtworks([...relatedArtworks, artworkId]);
    }
  };

  const handleRemoveArtwork = (artworkId: string) => {
    onUpdateArtworks(relatedArtworks.filter(id => id !== artworkId));
  };

  const formatCurrency = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Artworks</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsPickerOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {linkedArtworks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No artworks linked</p>
      ) : (
        <div className="space-y-2">
          {linkedArtworks.map((artwork) => (
            <div 
              key={artwork.id}
              className="flex items-center gap-3 p-2 border rounded-lg group hover:bg-muted/50 transition-colors"
            >
              {artwork.primary_image?.thumbnail_url ? (
                <img 
                  src={artwork.primary_image.thumbnail_url} 
                  alt={artwork.title}
                  className="w-12 h-12 object-cover rounded"
                />
              ) : (
                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                  <Palette className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{artwork.title}</p>
                <p className="text-xs text-muted-foreground">
                  {artwork.artist?.full_name}
                  {artwork.year && `, ${artwork.year}`}
                </p>
                {artwork.price && (
                  <p className="text-xs font-medium text-primary">
                    {formatCurrency(artwork.price, artwork.currency || 'GBP')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link to={`/artworks/${artwork.id}`}>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => handleRemoveArtwork(artwork.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Artwork Picker Dialog */}
      <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Artwork</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search artworks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {searchResults.map((artwork) => {
                  const isSelected = relatedArtworks.includes(artwork.id);
                  return (
                    <div 
                      key={artwork.id}
                      className={`flex items-center gap-3 p-2 border rounded-lg cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => isSelected ? handleRemoveArtwork(artwork.id) : handleAddArtwork(artwork.id)}
                    >
                      {artwork.primary_image?.thumbnail_url ? (
                        <img 
                          src={artwork.primary_image.thumbnail_url} 
                          alt={artwork.title}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                          <Palette className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{artwork.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {artwork.artist?.full_name}
                          {artwork.year && `, ${artwork.year}`}
                        </p>
                      </div>
                      {artwork.price && (
                        <p className="text-xs font-medium shrink-0">
                          {formatCurrency(artwork.price, artwork.currency || 'GBP')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsPickerOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
