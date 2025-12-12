import { useEffect, useState } from "react";
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

function HarvardObjectCard({ object }: { object: HarvardObject }) {
  return (
    <a
      href={object.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
    >
      {object.primaryImageUrl ? (
        <img
          src={object.primaryImageUrl}
          alt=""
          className="w-20 h-20 object-cover rounded flex-shrink-0"
        />
      ) : (
        <div className="w-20 h-20 bg-muted rounded flex-shrink-0 flex items-center justify-center">
          <Building2 className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm line-clamp-2 mb-1">{object.title}</h4>
        {object.dated && (
          <p className="text-xs text-muted-foreground mb-1">{object.dated}</p>
        )}
        {object.medium && (
          <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
            {object.medium}
          </p>
        )}
        {object.classification && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {object.classification}
          </Badge>
        )}
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </a>
  );
}

function RijksmuseumObjectCard({ object }: { object: RijksmuseumObject }) {
  return (
    <div className="flex gap-3 p-3 border rounded-lg">
      <div className="w-20 h-20 bg-muted rounded flex-shrink-0 flex items-center justify-center">
        <Landmark className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm line-clamp-2 mb-1">{object.title}</h4>
        {object.creator && (
          <p className="text-xs text-muted-foreground mb-1">{object.creator}</p>
        )}
        {object.date && (
          <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
            {object.date}
          </p>
        )}
        {object.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {object.description}
          </p>
        )}
      </div>
    </div>
  );
}

function MetObjectCard({ object }: { object: MetObject }) {
  return (
    <a
      href={object.objectURL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
    >
      {object.primaryImageSmall ? (
        <img
          src={object.primaryImageSmall}
          alt=""
          className="w-20 h-20 object-cover rounded flex-shrink-0"
        />
      ) : (
        <div className="w-20 h-20 bg-muted rounded flex-shrink-0 flex items-center justify-center">
          <Columns className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm line-clamp-2 mb-1">{object.title}</h4>
        {object.objectDate && (
          <p className="text-xs text-muted-foreground mb-1">{object.objectDate}</p>
        )}
        {object.medium && (
          <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
            {object.medium}
          </p>
        )}
        {object.department && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {object.department}
          </Badge>
        )}
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </a>
  );
}

function MomaObjectCard({ object }: { object: MomaObject }) {
  return (
    <a
      href={object.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
    >
      {object.thumbnailUrl ? (
        <img
          src={object.thumbnailUrl}
          alt=""
          className="w-20 h-20 object-cover rounded flex-shrink-0"
        />
      ) : (
        <div className="w-20 h-20 bg-muted rounded flex-shrink-0 flex items-center justify-center">
          <Square className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm line-clamp-2 mb-1">{object.title}</h4>
        {object.date && (
          <p className="text-xs text-muted-foreground mb-1">{object.date}</p>
        )}
        {object.medium && (
          <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
            {object.medium}
          </p>
        )}
        {object.department && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {object.department}
          </Badge>
        )}
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </a>
  );
}

function TateObjectCard({ object }: { object: TateObject }) {
  return (
    <a
      href={object.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
    >
      {object.thumbnailUrl ? (
        <img
          src={object.thumbnailUrl}
          alt=""
          className="w-20 h-20 object-cover rounded flex-shrink-0"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      <div className={`w-20 h-20 bg-muted rounded flex-shrink-0 flex items-center justify-center ${object.thumbnailUrl ? 'hidden' : ''}`}>
        <Frame className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm line-clamp-2 mb-1">{object.title}</h4>
        {object.date && (
          <p className="text-xs text-muted-foreground mb-1">{object.date}</p>
        )}
        {object.medium && (
          <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
            {object.medium}
          </p>
        )}
        {object.creditLine && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {object.creditLine}
          </p>
        )}
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </a>
  );
}

export function ArtistInfoPanel({ artist, open, onOpenChange }: ArtistInfoPanelProps) {
  const { searchArtist: searchGuardian, articles, isLoading: guardianLoading, error: guardianError } = useGuardianSearch();
  const { searchArtist: searchHarvard, objects: harvardObjects, totalObjects: harvardTotal, isLoading: harvardLoading, error: harvardError } = useHarvardMuseumSearch();
  const { searchArtist: searchRijks, objects: rijksObjects, totalObjects: rijksTotal, isLoading: rijksLoading, error: rijksError } = useRijksmuseumSearch();
  const { searchArtist: searchMet, objects: metObjects, totalObjects: metTotal, isLoading: metLoading, error: metError } = useMetMuseumSearch();
  const { searchArtist: searchMoma, objects: momaObjects, totalObjects: momaTotal, isLoading: momaLoading, error: momaError } = useMomaSearch();
  const { searchArtist: searchTate, objects: tateObjects, totalObjects: tateTotal, isLoading: tateLoading, error: tateError } = useTateSearch();
  const [articlesOpen, setArticlesOpen] = useState(false);
  const [harvardOpen, setHarvardOpen] = useState(false);
  const [rijksOpen, setRijksOpen] = useState(false);
  const [metOpen, setMetOpen] = useState(false);
  const [momaOpen, setMomaOpen] = useState(false);
  const [tateOpen, setTateOpen] = useState(false);

  useEffect(() => {
    if (open && artist.full_name) {
      searchGuardian(artist.full_name);
      searchHarvard(artist.full_name);
      searchRijks(artist.full_name);
      searchMet(artist.full_name);
      searchMoma(artist.full_name);
      searchTate(artist.full_name);
    }
  }, [open, artist.full_name, searchGuardian, searchHarvard, searchRijks, searchMet, searchMoma, searchTate]);

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
            
            {/* Guardian Articles Section */}
            <section className="space-y-3">
              <Collapsible open={articlesOpen} onOpenChange={setArticlesOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full hover:bg-muted/50 p-2 -m-2 transition-colors">
                  <Newspaper className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    The Guardian Articles
                  </h3>
                  {!guardianLoading && articles.length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      {articles.length}
                    </Badge>
                  )}
                  <ChevronDown 
                    className={`h-4 w-4 text-muted-foreground ml-auto transition-transform ${
                      articlesOpen ? "rotate-180" : ""
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
                  ) : guardianError ? (
                    <p className="text-sm text-destructive">{guardianError}</p>
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
                      No articles found for this artist.
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </section>
            
            <Separator />
            
            {/* Harvard Art Museums Section */}
            <section className="space-y-3">
              <Collapsible open={harvardOpen} onOpenChange={setHarvardOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full hover:bg-muted/50 p-2 -m-2 transition-colors">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Harvard Art Museums
                  </h3>
                  {!harvardLoading && harvardTotal > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      {harvardTotal}
                    </Badge>
                  )}
                  <ChevronDown 
                    className={`h-4 w-4 text-muted-foreground ml-auto transition-transform ${
                      harvardOpen ? "rotate-180" : ""
                    }`} 
                  />
                </CollapsibleTrigger>
                
                <CollapsibleContent className="pt-3">
                  {harvardLoading ? (
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
                  ) : harvardError ? (
                    <p className="text-sm text-destructive">{harvardError}</p>
                  ) : harvardObjects.length > 0 ? (
                    <ScrollArea className="h-[280px]">
                      <div className="space-y-2 pr-4">
                        {harvardObjects.map((object) => (
                          <HarvardObjectCard key={object.id} object={object} />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No works found in Harvard Art Museums collection.
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </section>
            
            {/* Rijksmuseum Section */}
            <Separator />
            <section className="space-y-3">
              <Collapsible open={rijksOpen} onOpenChange={setRijksOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full hover:bg-muted/50 p-2 -m-2 transition-colors">
                  <Landmark className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Rijksmuseum
                  </h3>
                  {!rijksLoading && rijksTotal > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      {rijksTotal}
                    </Badge>
                  )}
                  <ChevronDown 
                    className={`h-4 w-4 text-muted-foreground ml-auto transition-transform ${
                      rijksOpen ? "rotate-180" : ""
                    }`} 
                  />
                </CollapsibleTrigger>
                
                <CollapsibleContent className="pt-3">
                  {rijksLoading ? (
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
                  ) : rijksError ? (
                    <p className="text-sm text-destructive">{rijksError}</p>
                  ) : rijksObjects.length > 0 ? (
                    <ScrollArea className="h-[280px]">
                      <div className="space-y-2 pr-4">
                        {rijksObjects.map((object) => (
                          <RijksmuseumObjectCard key={object.id} object={object} />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No works found in Rijksmuseum collection.
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </section>
            
            {/* MET Museum Section */}
            <Separator />
            <section className="space-y-3">
              <Collapsible open={metOpen} onOpenChange={setMetOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full hover:bg-muted/50 p-2 -m-2 transition-colors">
                  <Columns className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    The Metropolitan Museum of Art
                  </h3>
                  {!metLoading && metTotal > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      {metTotal}
                    </Badge>
                  )}
                  <ChevronDown 
                    className={`h-4 w-4 text-muted-foreground ml-auto transition-transform ${
                      metOpen ? "rotate-180" : ""
                    }`} 
                  />
                </CollapsibleTrigger>
                
                <CollapsibleContent className="pt-3">
                  {metLoading ? (
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
                  ) : metError ? (
                    <p className="text-sm text-destructive">{metError}</p>
                  ) : metObjects.length > 0 ? (
                    <ScrollArea className="h-[280px]">
                      <div className="space-y-2 pr-4">
                        {metObjects.map((object) => (
                          <MetObjectCard key={object.objectID} object={object} />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No works found in MET Museum collection.
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </section>
            
            {/* MoMA Section */}
            <Separator />
            <section className="space-y-3">
              <Collapsible open={momaOpen} onOpenChange={setMomaOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full hover:bg-muted/50 p-2 -m-2 transition-colors">
                  <Square className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    MoMA New York
                  </h3>
                  {!momaLoading && momaTotal > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      {momaTotal}
                    </Badge>
                  )}
                  <ChevronDown 
                    className={`h-4 w-4 text-muted-foreground ml-auto transition-transform ${
                      momaOpen ? "rotate-180" : ""
                    }`} 
                  />
                </CollapsibleTrigger>
                
                <CollapsibleContent className="pt-3">
                  {momaLoading ? (
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
                  ) : momaError ? (
                    <p className="text-sm text-destructive">{momaError}</p>
                  ) : momaObjects.length > 0 ? (
                    <ScrollArea className="h-[280px]">
                      <div className="space-y-2 pr-4">
                        {momaObjects.map((object) => (
                          <MomaObjectCard key={object.objectId} object={object} />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No works found in MoMA collection.
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </section>
            
            {/* Tate Section */}
            <Separator />
            <section className="space-y-3">
              <Collapsible open={tateOpen} onOpenChange={setTateOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full hover:bg-muted/50 p-2 -m-2 transition-colors">
                  <Frame className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Tate London
                  </h3>
                  {!tateLoading && tateTotal > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      {tateTotal}
                    </Badge>
                  )}
                  <ChevronDown 
                    className={`h-4 w-4 text-muted-foreground ml-auto transition-transform ${
                      tateOpen ? "rotate-180" : ""
                    }`} 
                  />
                </CollapsibleTrigger>
                
                <CollapsibleContent className="pt-3">
                  {tateLoading ? (
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
                  ) : tateError ? (
                    <p className="text-sm text-destructive">{tateError}</p>
                  ) : tateObjects.length > 0 ? (
                    <ScrollArea className="h-[280px]">
                      <div className="space-y-2 pr-4">
                        {tateObjects.map((object) => (
                          <TateObjectCard key={object.id} object={object} />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No works found in Tate collection.
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
