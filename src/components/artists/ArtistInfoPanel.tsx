import { useEffect, useState, useCallback } from "react";
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
import { ExternalLink, Calendar, MapPin, Globe, Newspaper, ChevronDown, Building2, Landmark, Columns, Square, Frame } from "lucide-react";
import { useGuardianSearch, GuardianArticle } from "@/hooks/useGuardianSearch";
import { useHarvardMuseumSearch, HarvardObject } from "@/hooks/useHarvardMuseumSearch";
import { useRijksmuseumSearch, RijksmuseumObject } from "@/hooks/useRijksmuseumSearch";
import { useMetMuseumSearch, MetObject } from "@/hooks/useMetMuseumSearch";
import { useMomaSearch, MomaObject } from "@/hooks/useMomaSearch";
import { useTateSearch, TateObject } from "@/hooks/useTateSearch";
import { format } from "date-fns";

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
  source: 'harvard' | 'rijksmuseum' | 'met' | 'moma' | 'tate';
  sourceName: string;
  extra?: string;
}

function ArticleCard({ article }: { article: GuardianArticle }) {
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
          {article.sectionName && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {article.sectionName}
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
  const { searchArtist: searchGuardian, articles, isLoading: guardianLoading } = useGuardianSearch();
  const { searchArtist: searchHarvard, objects: harvardObjects, totalObjects: harvardTotal, isLoading: harvardLoading } = useHarvardMuseumSearch();
  const { searchArtist: searchRijks, objects: rijksObjects, totalObjects: rijksTotal, isLoading: rijksLoading } = useRijksmuseumSearch();
  const { searchArtist: searchMet, objects: metObjects, totalObjects: metTotal, isLoading: metLoading } = useMetMuseumSearch();
  const { searchArtist: searchMoma, objects: momaObjects, totalObjects: momaTotal, isLoading: momaLoading } = useMomaSearch();
  const { searchArtist: searchTate, objects: tateObjects, totalObjects: tateTotal, isLoading: tateLoading } = useTateSearch();
  
  const [mediaOpen, setMediaOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);

  // Sequential search function for stability
  const runSequentialSearches = useCallback(async (artistName: string) => {
    // Media searches first
    await searchGuardian(artistName);
    
    // Then museum searches sequentially
    await searchHarvard(artistName);
    await searchRijks(artistName);
    await searchMet(artistName);
    await searchMoma(artistName);
    await searchTate(artistName);
  }, [searchGuardian, searchHarvard, searchRijks, searchMet, searchMoma, searchTate]);

  useEffect(() => {
    if (open && artist.full_name) {
      runSequentialSearches(artist.full_name);
    }
  }, [open, artist.full_name, runSequentialSearches]);

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
  ];

  const totalCollectionCount = harvardTotal + rijksTotal + metTotal + momaTotal + tateTotal;
  const isCollectionsLoading = harvardLoading || rijksLoading || metLoading || momaLoading || tateLoading;

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
                  {!guardianLoading && articles.length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      {articles.length}
                    </Badge>
                  )}
                  <ChevronDown 
                    className={`h-4 w-4 text-muted-foreground ml-auto transition-transform ${
                      mediaOpen ? "rotate-180" : ""
                    }`} 
                  />
                </CollapsibleTrigger>
                
                <CollapsibleContent className="pt-3">
                  {guardianLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
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
                  ) : articles.length > 0 ? (
                    <ScrollArea className="h-[280px]">
                      <div className="space-y-2 pr-4">
                        {articles.map((article) => (
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
                  {/* Source summary badges */}
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
                    </div>
                  )}
                  
                  {isCollectionsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
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
            
            {/* Placeholder for future APIs */}
            <Separator />
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Coming Soon
              </h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Wikipedia
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Artsy
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Artnet
                </Badge>
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
