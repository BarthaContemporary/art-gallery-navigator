import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Download, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface ArtsySearchResult {
  title: string;
  artist: string;
  imageUrl: string;
  year?: string;
  medium?: string;
  dimensions?: string;
  sourceUrl: string;
}

interface ArtsyImageSearchProps {
  onImageSelected: (url: string) => void;
  defaultArtist?: string;
  defaultTitle?: string;
  defaultYear?: number;
}

export function ArtsyImageSearch({ 
  onImageSelected, 
  defaultArtist = '', 
  defaultTitle = '', 
  defaultYear 
}: ArtsyImageSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<ArtsySearchResult[]>([]);
  const [searchForm, setSearchForm] = useState({
    artist: defaultArtist,
    title: defaultTitle,
    year: defaultYear?.toString() || '',
  });

  const handleSearch = async () => {
    if (!searchForm.artist && !searchForm.title) {
      toast.error('Please enter an artist name or artwork title');
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-artsy-images', {
        body: {
          artist: searchForm.artist,
          title: searchForm.title,
          year: searchForm.year,
        },
      });

      if (error) throw error;

      setResults(data.results || []);
      
      if (data.results?.length === 0) {
        toast.info('No images found. Try adjusting your search terms.');
      } else {
        toast.success(`Found ${data.results.length} images`);
      }
    } catch (error) {
      console.error('Error searching Artsy:', error);
      toast.error('Failed to search Artsy. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectImage = (imageUrl: string) => {
    onImageSelected(imageUrl);
    setIsOpen(false);
    toast.success('Image selected from Artsy');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Search className="h-4 w-4" />
          Search Artsy
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Search Artsy.net for Images</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Search Form */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="artist">Artist Name</Label>
              <Input
                id="artist"
                value={searchForm.artist}
                onChange={(e) => setSearchForm(prev => ({ ...prev, artist: e.target.value }))}
                placeholder="e.g. Pablo Picasso"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Artwork Title</Label>
              <Input
                id="title"
                value={searchForm.title}
                onChange={(e) => setSearchForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Guernica"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Year (optional)</Label>
              <Input
                id="year"
                value={searchForm.year}
                onChange={(e) => setSearchForm(prev => ({ ...prev, year: e.target.value }))}
                placeholder="e.g. 1937"
              />
            </div>
          </div>

          <Button 
            onClick={handleSearch} 
            disabled={isSearching}
            className="w-full"
          >
            {isSearching ? 'Searching...' : 'Search Artsy'}
          </Button>

          {/* Results */}
          <div className="overflow-y-auto max-h-96">
            {isSearching ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="w-full h-32 mb-2" />
                      <Skeleton className="h-4 w-3/4 mb-1" />
                      <Skeleton className="h-3 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : results.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {results.map((result, index) => (
                  <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="aspect-square mb-2 overflow-hidden rounded">
                        <img
                          src={result.imageUrl}
                          alt={result.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      </div>
                      <h4 className="font-medium text-sm truncate">{result.title}</h4>
                      <p className="text-xs text-muted-foreground truncate">{result.artist}</p>
                      
                      <div className="flex gap-1 mt-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleSelectImage(result.imageUrl)}
                          className="flex-1"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Use
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(result.sourceUrl, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}