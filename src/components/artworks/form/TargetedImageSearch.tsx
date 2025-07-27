import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Download, ExternalLink, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface ImageSearchResult {
  title: string;
  artist: string;
  imageUrl: string;
  year?: string;
  medium?: string;
  dimensions?: string;
  sourceUrl: string;
  source: 'artsy' | 'ocula' | 'bartha' | 'google';
}

interface SearchResponse {
  results: ImageSearchResult[];
  totalResults: number;
  hasMore: boolean;
  page: number;
  itemsPerPage: number;
}

interface TargetedImageSearchProps {
  onImageSelected: (urls: string[]) => void;
  defaultArtist?: string;
  defaultTitle?: string;
  defaultYear?: number;
}

export function TargetedImageSearch({ 
  onImageSelected, 
  defaultArtist = '', 
  defaultTitle = '', 
  defaultYear 
}: TargetedImageSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [results, setResults] = useState<ImageSearchResult[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchForm, setSearchForm] = useState({
    artist: defaultArtist,
    title: defaultTitle,
    year: defaultYear?.toString() || '',
  });

  const handleSearch = async (page: number = 1, append: boolean = false) => {
    if (!searchForm.artist && !searchForm.title) {
      toast.error('Please enter an artist name or artwork title');
      return;
    }

    const loading = page === 1 ? setIsSearching : setIsLoadingMore;
    loading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('targeted-image-search', {
        body: {
          artist: searchForm.artist,
          title: searchForm.title,
          year: searchForm.year,
          page,
        },
      });

      if (error) throw error;

      const newResults = data.results || [];
      setResults(prev => append ? [...prev, ...newResults] : newResults);
      setSearchResponse(data);
      setCurrentPage(page);
      
      if (newResults.length === 0 && !append) {
        toast.info('No images found. Try adjusting your search terms.');
      } else if (!append) {
        toast.success(`Found ${data.totalResults} images`);
      }
    } catch (error) {
      console.error('Error searching:', error);
      toast.error('Failed to search for images. Please try again.');
    } finally {
      loading(false);
    }
  };

  const handleLoadMore = () => {
    handleSearch(currentPage + 1, true);
  };

  const toggleImageSelection = (imageUrl: string) => {
    setSelectedImages(prev => {
      if (prev.includes(imageUrl)) {
        return prev.filter(url => url !== imageUrl);
      } else {
        return [...prev, imageUrl];
      }
    });
  };

  const handleImportSelected = () => {
    if (selectedImages.length === 0) {
      toast.error('Please select at least one image');
      return;
    }
    
    onImageSelected(selectedImages);
    setIsOpen(false);
    setSelectedImages([]);
    toast.success(`${selectedImages.length} image(s) selected for import`);
  };


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Search className="h-4 w-4" />
          Targeted Image Search
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Targeted Image Search</DialogTitle>
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

          <div className="flex gap-2">
            <Button 
              onClick={() => handleSearch()} 
              disabled={isSearching}
              className="flex-1"
            >
              {isSearching ? 'Searching...' : 'Search Images'}
            </Button>
            {selectedImages.length > 0 && (
              <Button 
                onClick={handleImportSelected}
                variant="secondary"
                className="min-w-[120px]"
              >
                Import {selectedImages.length}
              </Button>
            )}
          </div>

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
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {results.map((result, index) => {
                    const isSelected = selectedImages.includes(result.imageUrl);
                    return (
                      <Card 
                        key={index} 
                        className={`cursor-pointer hover:shadow-md transition-all relative ${
                          isSelected ? 'ring-2 ring-primary shadow-lg' : ''
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="aspect-square mb-2 overflow-hidden rounded relative">
                            <img
                              src={result.imageUrl}
                              alt={result.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                            {isSelected && (
                              <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                          <h4 className="font-medium text-sm truncate">{result.title}</h4>
                          <p className="text-xs text-muted-foreground truncate">{result.artist}</p>
                          <p className="text-xs text-muted-foreground capitalize">{result.source}</p>
                          
                          <div className="flex gap-1 mt-2">
                            <Button
                              size="sm"
                              variant={isSelected ? "default" : "outline"}
                              onClick={() => toggleImageSelection(result.imageUrl)}
                              className="flex-1"
                            >
                              {isSelected ? (
                                <>
                                  <Check className="h-3 w-3 mr-1" />
                                  Selected
                                </>
                              ) : (
                                <>
                                  <Download className="h-3 w-3 mr-1" />
                                  Select
                                </>
                              )}
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
                    );
                  })}
                </div>
                
                {searchResponse?.hasMore && (
                  <div className="text-center">
                    <Button 
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      variant="outline"
                    >
                      {isLoadingMore ? 'Loading...' : 'Load More'}
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}