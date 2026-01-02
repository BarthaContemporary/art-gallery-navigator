import { useEffect, useState, useCallback, useRef } from "react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ExternalLink, Calendar, MapPin, Globe, Newspaper, ChevronDown, Building2, Landmark, Columns, Square, Frame, Home, Building, Castle, GalleryHorizontal } from "lucide-react";
import { useGuardianSearch } from "@/hooks/useGuardianSearch";
import { useNewsAPISearch } from "@/hooks/useNewsAPISearch";
import { useHarvardMuseumSearch } from "@/hooks/useHarvardMuseumSearch";
import { useRijksmuseumSearch } from "@/hooks/useRijksmuseumSearch";
import { useMetMuseumSearch } from "@/hooks/useMetMuseumSearch";
import { useMomaSearch } from "@/hooks/useMomaSearch";
import { useTateSearch } from "@/hooks/useTateSearch";
import { useArtInstituteChicagoSearch } from "@/hooks/useArtInstituteChicagoSearch";
import { useNationalGallerySearch } from "@/hooks/useNationalGallerySearch";
import { useGuggenheimSearch } from "@/hooks/useGuggenheimSearch";
import { useWhitneySearch } from "@/hooks/useWhitneySearch";
import { format } from "date-fns";
import { SearchProgressIndicator, SearchSource, createMediaSources, createCollectionSources } from "./SearchProgressIndicator";

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

// Unified collection item type for combined display
interface CollectionItem {
  id: string;
  title: string;
  date?: string;
  medium?: string;
  url?: string;
  imageUrl?: string;
  source: 'harvard' | 'rijksmuseum' | 'met' | 'moma' | 'tate' | 'aic' | 'national-gallery' | 'guggenheim' | 'whitney';
  sourceName: string;
  extra?: string;
}

// Unified media article type combining Guardian and NewsAPI
interface MediaArticle {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  url: string;
  sourceName?: string;
  publishedDate?: string;
}

function ArticleCard({ article }: { article: MediaArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
    >
      {article.thumbnail && (
        <img
          src={article.thumbnail}
          alt=""
          className="w-20 h-20 object-cover rounded flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm line-clamp-2 mb-1">{article.title}</h4>
        {article.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
            {article.description}
          </p>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {article.sourceName && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {article.sourceName}
            </Badge>
          )}
          {article.publishedDate && (
            <span>{format(new Date(article.publishedDate), "MMM d, yyyy")}</span>
          )}
        </div>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </a>
  );
}

function CollectionItemCard({ item }: { item: CollectionItem }) {
  const getSourceIcon = () => {
    switch (item.source) {
      case 'harvard': return <Building2 className="h-3 w-3" />;
      case 'rijksmuseum': return <Landmark className="h-3 w-3" />;
      case 'met': return <Columns className="h-3 w-3" />;
      case 'moma': return <Square className="h-3 w-3" />;
      case 'tate': return <Frame className="h-3 w-3" />;
      case 'aic': return <Home className="h-3 w-3" />;
      case 'national-gallery': return <Castle className="h-3 w-3" />;
      case 'guggenheim': return <Building className="h-3 w-3" />;
      case 'whitney': return <GalleryHorizontal className="h-3 w-3" />;
    }
  };

  const content = (
    <>
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt=""
          className="w-16 h-16 object-cover rounded flex-shrink-0"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="w-16 h-16 bg-muted rounded flex-shrink-0 flex items-center justify-center">
          {getSourceIcon()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm line-clamp-2 mb-1">{item.title}</h4>
        {item.date && (
          <p className="text-xs text-muted-foreground mb-1">{item.date}</p>
        )}
        {item.medium && (
          <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
            {item.medium}
          </p>
        )}
        <Badge variant="outline" className="text-xs px-1.5 py-0">
          {getSourceIcon()}
          <span className="ml-1">{item.sourceName}</span>
        </Badge>
      </div>
      {item.url && <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
    </>
  );

  if (item.url) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="flex gap-3 p-3 border rounded-lg">
      {content}
    </div>
  );
}

export function ArtistInfoPanel({ artist, open, onOpenChange }: ArtistInfoPanelProps) {
  const { searchArtist: searchGuardian, articles: guardianArticles, isLoading: guardianLoading } = useGuardianSearch();
  const { searchArtist: searchNewsAPI, articles: newsApiArticles, isLoading: newsApiLoading } = useNewsAPISearch();
  const { searchArtist: searchHarvard, objects: harvardObjects, totalObjects: harvardTotal, isLoading: harvardLoading } = useHarvardMuseumSearch();
  const { searchArtist: searchRijks, objects: rijksObjects, totalObjects: rijksTotal, isLoading: rijksLoading } = useRijksmuseumSearch();
  const { searchArtist: searchMet, objects: metObjects, totalObjects: metTotal, isLoading: metLoading } = useMetMuseumSearch();
  const { searchArtist: searchMoma, objects: momaObjects, totalObjects: momaTotal, isLoading: momaLoading } = useMomaSearch();
  const { searchArtist: searchTate, objects: tateObjects, totalObjects: tateTotal, isLoading: tateLoading } = useTateSearch();
  const { searchArtist: searchAIC, objects: aicObjects, totalObjects: aicTotal, isLoading: aicLoading } = useArtInstituteChicagoSearch();
  const { searchArtist: searchNationalGallery, objects: ngObjects, totalObjects: ngTotal, isLoading: ngLoading } = useNationalGallerySearch();
  const { searchArtist: searchGuggenheim, objects: guggenheimObjects, totalObjects: guggenheimTotal, isLoading: guggenheimLoading } = useGuggenheimSearch();
  const { searchArtist: searchWhitney, objects: whitneyObjects, totalObjects: whitneyTotal, isLoading: whitneyLoading } = useWhitneySearch();
  
  const [mediaOpen, setMediaOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  
  // Progress tracking state
  const [mediaSources, setMediaSources] = useState<SearchSource[]>(createMediaSources());
  const [collectionSources, setCollectionSources] = useState<SearchSource[]>(createCollectionSources());
  const searchInProgressRef = useRef(false);

  // Update a source's status
  const updateMediaSource = useCallback((id: string, status: SearchSource['status'], resultCount?: number) => {
    setMediaSources(prev => prev.map(s => 
      s.id === id ? { ...s, status, resultCount } : s
    ));
  }, []);

  const updateCollectionSource = useCallback((id: string, status: SearchSource['status'], resultCount?: number) => {
    setCollectionSources(prev => prev.map(s => 
      s.id === id ? { ...s, status, resultCount } : s
    ));
  }, []);

  // Sequential search function with progress tracking
  const runSequentialSearches = useCallback(async (artistName: string) => {
    if (searchInProgressRef.current) return;
    searchInProgressRef.current = true;

    // Reset all sources
    setMediaSources(createMediaSources());
    setCollectionSources(createCollectionSources());

    // Media searches
    updateMediaSource('guardian', 'searching');
    await searchGuardian(artistName);
    updateMediaSource('guardian', 'complete', guardianArticles.length);
    
    updateMediaSource('newsapi', 'searching');
    await searchNewsAPI(artistName);
    updateMediaSource('newsapi', 'complete', newsApiArticles.length);
    
    // Collection searches
    updateCollectionSource('harvard', 'searching');
    await searchHarvard(artistName);
    updateCollectionSource('harvard', 'complete', harvardTotal);
    
    updateCollectionSource('rijksmuseum', 'searching');
    await searchRijks(artistName);
    updateCollectionSource('rijksmuseum', 'complete', rijksTotal);
    
    updateCollectionSource('met', 'searching');
    await searchMet(artistName);
    updateCollectionSource('met', 'complete', metTotal);
    
    updateCollectionSource('moma', 'searching');
    await searchMoma(artistName);
    updateCollectionSource('moma', 'complete', momaTotal);
    
    updateCollectionSource('tate', 'searching');
    await searchTate(artistName);
    updateCollectionSource('tate', 'complete', tateTotal);
    
    updateCollectionSource('aic', 'searching');
    await searchAIC(artistName);
    updateCollectionSource('aic', 'complete', aicTotal);
    
    updateCollectionSource('national-gallery', 'searching');
    await searchNationalGallery(artistName);
    updateCollectionSource('national-gallery', 'complete', ngTotal);
    
    updateCollectionSource('guggenheim', 'searching');
    await searchGuggenheim(artistName);
    updateCollectionSource('guggenheim', 'complete', guggenheimTotal);
    
    updateCollectionSource('whitney', 'searching');
    await searchWhitney(artistName);
    updateCollectionSource('whitney', 'complete', whitneyTotal);

    searchInProgressRef.current = false;
  }, [searchGuardian, searchNewsAPI, searchHarvard, searchRijks, searchMet, searchMoma, searchTate, searchAIC, searchNationalGallery, searchGuggenheim, searchWhitney, updateMediaSource, updateCollectionSource]);

  // Effect to update counts after searches complete
  useEffect(() => {
    if (!guardianLoading) {
      updateMediaSource('guardian', 'complete', guardianArticles.length);
    }
  }, [guardianLoading, guardianArticles.length, updateMediaSource]);

  useEffect(() => {
    if (!newsApiLoading) {
      updateMediaSource('newsapi', 'complete', newsApiArticles.length);
    }
  }, [newsApiLoading, newsApiArticles.length, updateMediaSource]);

  useEffect(() => {
    if (!harvardLoading) updateCollectionSource('harvard', 'complete', harvardTotal);
  }, [harvardLoading, harvardTotal, updateCollectionSource]);

  useEffect(() => {
    if (!rijksLoading) updateCollectionSource('rijksmuseum', 'complete', rijksTotal);
  }, [rijksLoading, rijksTotal, updateCollectionSource]);

  useEffect(() => {
    if (!metLoading) updateCollectionSource('met', 'complete', metTotal);
  }, [metLoading, metTotal, updateCollectionSource]);

  useEffect(() => {
    if (!momaLoading) updateCollectionSource('moma', 'complete', momaTotal);
  }, [momaLoading, momaTotal, updateCollectionSource]);

  useEffect(() => {
    if (!tateLoading) updateCollectionSource('tate', 'complete', tateTotal);
  }, [tateLoading, tateTotal, updateCollectionSource]);

  useEffect(() => {
    if (!aicLoading) updateCollectionSource('aic', 'complete', aicTotal);
  }, [aicLoading, aicTotal, updateCollectionSource]);

  useEffect(() => {
    if (!ngLoading) updateCollectionSource('national-gallery', 'complete', ngTotal);
  }, [ngLoading, ngTotal, updateCollectionSource]);

  useEffect(() => {
    if (!guggenheimLoading) updateCollectionSource('guggenheim', 'complete', guggenheimTotal);
  }, [guggenheimLoading, guggenheimTotal, updateCollectionSource]);

  useEffect(() => {
    if (!whitneyLoading) updateCollectionSource('whitney', 'complete', whitneyTotal);
  }, [whitneyLoading, whitneyTotal, updateCollectionSource]);

  useEffect(() => {
    if (open && artist.full_name) {
      runSequentialSearches(artist.full_name);
    }
  }, [open, artist.full_name, runSequentialSearches]);

  // Combine all media articles from Guardian and NewsAPI, deduplicated by URL
  const allMediaArticles: MediaArticle[] = (() => {
    const seenUrls = new Set<string>();
    const combined: MediaArticle[] = [];
    
    // Add Guardian articles first
    guardianArticles.forEach(article => {
      if (!seenUrls.has(article.url)) {
        seenUrls.add(article.url);
        combined.push({
          id: article.id,
          title: article.title,
          description: article.description,
          thumbnail: article.thumbnail,
          url: article.url,
          sourceName: article.sectionName || 'The Guardian',
          publishedDate: article.publishedDate,
        });
      }
    });
    
    // Add NewsAPI articles
    newsApiArticles.forEach(article => {
      if (!seenUrls.has(article.url)) {
        seenUrls.add(article.url);
        combined.push({
          id: article.id,
          title: article.title,
          description: article.description,
          thumbnail: article.thumbnail,
          url: article.url,
          sourceName: article.sourceName,
          publishedDate: article.publishedDate,
        });
      }
    });
    
    // Sort by date (newest first)
    return combined.sort((a, b) => {
      if (!a.publishedDate) return 1;
      if (!b.publishedDate) return -1;
      return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
    });
  })();

  const isMediaLoading = guardianLoading || newsApiLoading;

  // Combine all collection items
  const allCollectionItems: CollectionItem[] = [
    ...harvardObjects.map((obj): CollectionItem => ({
      id: `harvard-${obj.id}`,
      title: obj.title,
      date: obj.dated,
      medium: obj.medium,
      url: obj.url,
      imageUrl: obj.primaryImageUrl,
      source: 'harvard',
      sourceName: 'Harvard',
      extra: obj.classification,
    })),
    ...rijksObjects.map((obj): CollectionItem => ({
      id: `rijks-${obj.id}`,
      title: obj.title,
      date: obj.date,
      medium: obj.description,
      url: undefined,
      imageUrl: undefined,
      source: 'rijksmuseum',
      sourceName: 'Rijksmuseum',
    })),
    ...metObjects.map((obj): CollectionItem => ({
      id: `met-${obj.objectID}`,
      title: obj.title,
      date: obj.objectDate,
      medium: obj.medium,
      url: obj.objectURL,
      imageUrl: obj.primaryImageSmall,
      source: 'met',
      sourceName: 'MET',
      extra: obj.department,
    })),
    ...momaObjects.map((obj): CollectionItem => ({
      id: `moma-${obj.objectId}`,
      title: obj.title,
      date: obj.date,
      medium: obj.medium,
      url: obj.url,
      imageUrl: obj.thumbnailUrl,
      source: 'moma',
      sourceName: 'MoMA',
      extra: obj.department,
    })),
    ...tateObjects.map((obj): CollectionItem => ({
      id: `tate-${obj.id}`,
      title: obj.title,
      date: obj.date,
      medium: obj.medium,
      url: obj.url,
      imageUrl: obj.thumbnailUrl,
      source: 'tate',
      sourceName: 'Tate',
      extra: obj.creditLine,
    })),
    ...aicObjects.map((obj): CollectionItem => ({
      id: `aic-${obj.id}`,
      title: obj.title,
      date: obj.dateDisplay,
      medium: obj.medium,
      url: obj.url,
      imageUrl: obj.imageUrl || obj.thumbnailUrl,
      source: 'aic',
      sourceName: 'Art Institute Chicago',
      extra: obj.department,
    })),
    ...ngObjects.map((obj): CollectionItem => ({
      id: `ng-${obj.id}`,
      title: obj.title,
      date: obj.date,
      medium: obj.medium,
      url: obj.url || undefined,
      imageUrl: obj.imageUrl || undefined,
      source: 'national-gallery',
      sourceName: 'National Gallery',
    })),
    ...guggenheimObjects.map((obj): CollectionItem => ({
      id: obj.id,
      title: obj.title,
      date: obj.date,
      medium: obj.medium,
      url: obj.url,
      imageUrl: obj.imageUrl || undefined,
      source: 'guggenheim',
      sourceName: 'Guggenheim',
    })),
    ...whitneyObjects.map((obj): CollectionItem => ({
      id: obj.id,
      title: obj.title,
      date: obj.date,
      medium: obj.medium,
      url: obj.url,
      imageUrl: obj.imageUrl || undefined,
      source: 'whitney',
      sourceName: 'Whitney',
    })),
  ];

  const totalCollectionCount = harvardTotal + rijksTotal + metTotal + momaTotal + tateTotal + aicTotal + ngTotal + guggenheimTotal + whitneyTotal;
  const isCollectionsLoading = harvardLoading || rijksLoading || metLoading || momaLoading || tateLoading || aicLoading || ngLoading || guggenheimLoading || whitneyLoading;

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
            
            {/* Media Section (formerly Guardian Articles) */}
            <section className="space-y-3">
              <Collapsible open={mediaOpen} onOpenChange={setMediaOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full hover:bg-muted/50 p-2 -m-2 transition-colors">
                  <Newspaper className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Media
                  </h3>
                  {!isMediaLoading && allMediaArticles.length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      {allMediaArticles.length}
                    </Badge>
                  )}
                  <ChevronDown 
                    className={`h-4 w-4 text-muted-foreground ml-auto transition-transform ${
                      mediaOpen ? "rotate-180" : ""
                    }`} 
                  />
                </CollapsibleTrigger>
                
                <CollapsibleContent className="pt-3">
                  {isMediaLoading ? (
                    <div className="space-y-4">
                      <SearchProgressIndicator sources={mediaSources} variant="media" />
                      <div className="space-y-2">
                        {[1, 2].map((i) => (
                          <div key={i} className="flex gap-3 p-3 border rounded-lg">
                            <Skeleton className="w-20 h-20 rounded" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-3 w-3/4" />
                              <Skeleton className="h-3 w-1/2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : allMediaArticles.length > 0 ? (
                    <ScrollArea className="h-[280px]">
                      <div className="space-y-2 pr-4">
                        {allMediaArticles.map((article) => (
                          <ArticleCard key={article.id} article={article} />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No media coverage found for this artist.
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </section>
            
            <Separator />
            
            {/* Works in Public Collections Section */}
            <section className="space-y-3">
              <Collapsible open={collectionsOpen} onOpenChange={setCollectionsOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full hover:bg-muted/50 p-2 -m-2 transition-colors">
                  <Landmark className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Works in Public Collections
                  </h3>
                  {!isCollectionsLoading && totalCollectionCount > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      {totalCollectionCount}
                    </Badge>
                  )}
                  {isCollectionsLoading && (
                    <span className="text-xs text-muted-foreground ml-1">Loading...</span>
                  )}
                  <ChevronDown 
                    className={`h-4 w-4 text-muted-foreground ml-auto transition-transform ${
                      collectionsOpen ? "rotate-180" : ""
                    }`} 
                  />
                </CollapsibleTrigger>
                
                <CollapsibleContent className="pt-3">
                  {/* Progress indicator during loading */}
                  {isCollectionsLoading && (
                    <div className="mb-4">
                      <SearchProgressIndicator sources={collectionSources} variant="collections" />
                    </div>
                  )}

                  {/* Source summary badges after loading */}
                  {!isCollectionsLoading && totalCollectionCount > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {harvardTotal > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Building2 className="h-3 w-3 mr-1" />
                          Harvard: {harvardTotal}
                        </Badge>
                      )}
                      {rijksTotal > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Landmark className="h-3 w-3 mr-1" />
                          Rijksmuseum: {rijksTotal}
                        </Badge>
                      )}
                      {metTotal > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Columns className="h-3 w-3 mr-1" />
                          MET: {metTotal}
                        </Badge>
                      )}
                      {momaTotal > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Square className="h-3 w-3 mr-1" />
                          MoMA: {momaTotal}
                        </Badge>
                      )}
                      {tateTotal > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Frame className="h-3 w-3 mr-1" />
                          Tate: {tateTotal}
                        </Badge>
                      )}
                      {aicTotal > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Home className="h-3 w-3 mr-1" />
                          AIC: {aicTotal}
                        </Badge>
                      )}
                      {ngTotal > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Castle className="h-3 w-3 mr-1" />
                          National Gallery: {ngTotal}
                        </Badge>
                      )}
                      {guggenheimTotal > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Building className="h-3 w-3 mr-1" />
                          Guggenheim: {guggenheimTotal}
                        </Badge>
                      )}
                      {whitneyTotal > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <GalleryHorizontal className="h-3 w-3 mr-1" />
                          Whitney: {whitneyTotal}
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  {isCollectionsLoading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <div key={i} className="flex gap-3 p-3 border rounded-lg">
                          <Skeleton className="w-16 h-16 rounded" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-3 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : allCollectionItems.length > 0 ? (
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-2 pr-4">
                        {allCollectionItems.map((item) => (
                          <CollectionItemCard key={item.id} item={item} />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No works found in public collections.
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
