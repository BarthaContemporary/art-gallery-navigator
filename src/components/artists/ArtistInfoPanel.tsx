import { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ExternalLink, Calendar, MapPin, Globe, Newspaper, ChevronDown, Building2, Landmark, Columns, Square, Frame, Home, Building, Castle, GalleryHorizontal, Filter, Library, Archive, BookOpen, Palette, Crown } from "lucide-react";
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
import { useBritishMuseumSearch } from "@/hooks/useBritishMuseumSearch";
import { useVAMuseumSearch } from "@/hooks/useVAMuseumSearch";
import { useClevelandMuseumSearch } from "@/hooks/useClevelandMuseumSearch";
import { useGettyMuseumSearch } from "@/hooks/useGettyMuseumSearch";
import { useWaltersMuseumSearch } from "@/hooks/useWaltersMuseumSearch";
import { useSmithsonianSearch } from "@/hooks/useSmithsonianSearch";
import { useNGASearch } from "@/hooks/useNGASearch";
import { useEuropeanaSearch } from "@/hooks/useEuropeanaSearch";
import { useDPLASearch } from "@/hooks/useDPLASearch";
import { useSMKSearch } from "@/hooks/useSMKSearch";
import { useNeubergerMuseumSearch } from "@/hooks/useNeubergerMuseumSearch";
import { useAlbrightKnoxSearch } from "@/hooks/useAlbrightKnoxSearch";
import { format } from "date-fns";
import { SearchProgressIndicator, SearchSource, createMediaSources, createCollectionSources } from "./SearchProgressIndicator";

// Institution filter options
type InstitutionSource = 'harvard' | 'rijksmuseum' | 'met' | 'moma' | 'tate' | 'aic' | 'national-gallery' | 'guggenheim' | 'whitney' | 'british-museum' | 'va' | 'cleveland' | 'getty' | 'walters' | 'smithsonian' | 'nga' | 'europeana' | 'dpla' | 'smk' | 'neuberger' | 'akg';

const INSTITUTION_OPTIONS: { id: InstitutionSource; name: string; icon: React.ReactNode }[] = [
  { id: 'harvard', name: 'Harvard Art Museums', icon: <Building2 className="h-4 w-4" /> },
  { id: 'rijksmuseum', name: 'Rijksmuseum', icon: <Landmark className="h-4 w-4" /> },
  { id: 'met', name: 'Metropolitan Museum', icon: <Columns className="h-4 w-4" /> },
  { id: 'moma', name: 'MoMA', icon: <Square className="h-4 w-4" /> },
  { id: 'tate', name: 'Tate', icon: <Frame className="h-4 w-4" /> },
  { id: 'aic', name: 'Art Institute Chicago', icon: <Home className="h-4 w-4" /> },
  { id: 'national-gallery', name: 'National Gallery', icon: <Castle className="h-4 w-4" /> },
  { id: 'guggenheim', name: 'Guggenheim', icon: <Building className="h-4 w-4" /> },
  { id: 'whitney', name: 'Whitney', icon: <GalleryHorizontal className="h-4 w-4" /> },
  { id: 'british-museum', name: 'British Museum', icon: <Library className="h-4 w-4" /> },
  { id: 'va', name: 'V&A Museum', icon: <Palette className="h-4 w-4" /> },
  { id: 'cleveland', name: 'Cleveland', icon: <Building2 className="h-4 w-4" /> },
  { id: 'getty', name: 'Getty', icon: <Landmark className="h-4 w-4" /> },
  { id: 'walters', name: 'Walters', icon: <Castle className="h-4 w-4" /> },
  { id: 'smithsonian', name: 'Smithsonian', icon: <Archive className="h-4 w-4" /> },
  { id: 'nga', name: 'National Gallery of Art', icon: <Columns className="h-4 w-4" /> },
  { id: 'europeana', name: 'Europeana', icon: <Globe className="h-4 w-4" /> },
  { id: 'dpla', name: 'DPLA', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'smk', name: 'SMK Denmark', icon: <Crown className="h-4 w-4" /> },
  { id: 'neuberger', name: 'Neuberger Museum', icon: <Building2 className="h-4 w-4" /> },
  { id: 'akg', name: 'Buffalo AKG', icon: <GalleryHorizontal className="h-4 w-4" /> },
];

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
  source: InstitutionSource;
  sourceName: string;
  extra?: string;
  location?: string;
  dimensions?: string;
  collection?: string;
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
      case 'british-museum': return <Library className="h-3 w-3" />;
      case 'va': return <Palette className="h-3 w-3" />;
      case 'cleveland': return <Building2 className="h-3 w-3" />;
      case 'getty': return <Landmark className="h-3 w-3" />;
      case 'walters': return <Castle className="h-3 w-3" />;
      case 'smithsonian': return <Archive className="h-3 w-3" />;
      case 'nga': return <Columns className="h-3 w-3" />;
      case 'europeana': return <Globe className="h-3 w-3" />;
      case 'dpla': return <BookOpen className="h-3 w-3" />;
      case 'smk': return <Crown className="h-3 w-3" />;
      default: return <Building2 className="h-3 w-3" />;
    }
  };

  const content = (
    <>
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt=""
          className="w-20 h-20 object-cover rounded flex-shrink-0"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="w-20 h-20 bg-muted rounded flex-shrink-0 flex items-center justify-center">
          {getSourceIcon()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm line-clamp-2 mb-1">{item.title}</h4>
        
        {/* Date and dimensions row */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          {item.date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {item.date}
            </span>
          )}
          {item.dimensions && (
            <span className="truncate">{item.dimensions}</span>
          )}
        </div>
        
        {/* Medium */}
        {item.medium && (
          <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
            {item.medium}
          </p>
        )}
        
        {/* Extra info (department/classification/collection) */}
        {(item.extra || item.collection) && (
          <p className="text-xs text-muted-foreground/70 line-clamp-1 mb-1">
            {item.extra || item.collection}
          </p>
        )}
        
        {/* Location badge if present */}
        {item.location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{item.location}</span>
          </div>
        )}
        
        {/* Source badge */}
        <Badge variant="outline" className="text-xs px-1.5 py-0">
          {getSourceIcon()}
          <span className="ml-1">{item.sourceName}</span>
        </Badge>
      </div>
      {item.url && <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />}
    </>
  );

  if (item.url) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors items-start"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="flex gap-3 p-3 border rounded-lg items-start">
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
  const { searchArtist: searchBritishMuseum, objects: britishMuseumObjects, totalObjects: britishMuseumTotal, isLoading: britishMuseumLoading } = useBritishMuseumSearch();
  const { searchArtist: searchVA, objects: vaObjects, totalObjects: vaTotal, isLoading: vaLoading } = useVAMuseumSearch();
  const { searchArtist: searchCleveland, objects: clevelandObjects, totalObjects: clevelandTotal, isLoading: clevelandLoading } = useClevelandMuseumSearch();
  const { searchArtist: searchGetty, objects: gettyObjects, totalObjects: gettyTotal, isLoading: gettyLoading } = useGettyMuseumSearch();
  const { searchArtist: searchWalters, objects: waltersObjects, totalObjects: waltersTotal, isLoading: waltersLoading } = useWaltersMuseumSearch();
  const { searchByArtist: searchSmithsonian, results: smithsonianResults, totalResults: smithsonianTotal, isLoading: smithsonianLoading } = useSmithsonianSearch();
  const { searchArtist: searchNGA, objects: ngaObjects, totalObjects: ngaTotal, isLoading: ngaLoading } = useNGASearch();
  const { searchArtist: searchEuropeana, objects: europeanaObjects, totalObjects: europeanaTotal, isLoading: europeanaLoading } = useEuropeanaSearch();
  const { searchByArtist: searchDPLA, results: dplaResults, totalResults: dplaTotal, isLoading: dplaLoading } = useDPLASearch();
  const { searchArtist: searchSMK, objects: smkObjects, totalObjects: smkTotal, isLoading: smkLoading } = useSMKSearch();
  const { searchArtist: searchNeuberger, objects: neubergerObjects, totalObjects: neubergerTotal, isLoading: neubergerLoading } = useNeubergerMuseumSearch();
  const { searchArtist: searchAKG, objects: akgObjects, totalObjects: akgTotal, isLoading: akgLoading } = useAlbrightKnoxSearch();
  
  const [mediaOpen, setMediaOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  
  // Institution filter state - all selected by default
  const [selectedInstitutions, setSelectedInstitutions] = useState<Set<InstitutionSource>>(
    new Set(INSTITUTION_OPTIONS.map(opt => opt.id))
  );
  
  // Progress tracking state
  const [mediaSources, setMediaSources] = useState<SearchSource[]>(createMediaSources());
  const [collectionSources, setCollectionSources] = useState<SearchSource[]>(createCollectionSources());
  const searchInProgressRef = useRef(false);
  
  // Toggle institution selection
  const toggleInstitution = useCallback((id: InstitutionSource) => {
    setSelectedInstitutions(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);
  
  // Select/deselect all
  const selectAllInstitutions = useCallback(() => {
    setSelectedInstitutions(new Set(INSTITUTION_OPTIONS.map(opt => opt.id)));
  }, []);
  
  const deselectAllInstitutions = useCallback(() => {
    setSelectedInstitutions(new Set());
  }, []);

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

    try {
      // Media searches
      setMediaSources(prev => prev.map(s => s.id === 'guardian' ? { ...s, status: 'searching' as const } : s));
      await searchGuardian(artistName);
      
      setMediaSources(prev => prev.map(s => s.id === 'newsapi' ? { ...s, status: 'searching' as const } : s));
      await searchNewsAPI(artistName);
      
      // Collection searches
      setCollectionSources(prev => prev.map(s => s.id === 'harvard' ? { ...s, status: 'searching' as const } : s));
      await searchHarvard(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'rijksmuseum' ? { ...s, status: 'searching' as const } : s));
      await searchRijks(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'met' ? { ...s, status: 'searching' as const } : s));
      await searchMet(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'moma' ? { ...s, status: 'searching' as const } : s));
      await searchMoma(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'tate' ? { ...s, status: 'searching' as const } : s));
      await searchTate(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'aic' ? { ...s, status: 'searching' as const } : s));
      await searchAIC(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'national-gallery' ? { ...s, status: 'searching' as const } : s));
      await searchNationalGallery(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'guggenheim' ? { ...s, status: 'searching' as const } : s));
      await searchGuggenheim(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'whitney' ? { ...s, status: 'searching' as const } : s));
      await searchWhitney(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'british-museum' ? { ...s, status: 'searching' as const } : s));
      await searchBritishMuseum(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'va' ? { ...s, status: 'searching' as const } : s));
      await searchVA(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'cleveland' ? { ...s, status: 'searching' as const } : s));
      await searchCleveland(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'getty' ? { ...s, status: 'searching' as const } : s));
      await searchGetty(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'walters' ? { ...s, status: 'searching' as const } : s));
      await searchWalters(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'smithsonian' ? { ...s, status: 'searching' as const } : s));
      await searchSmithsonian(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'nga' ? { ...s, status: 'searching' as const } : s));
      await searchNGA(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'europeana' ? { ...s, status: 'searching' as const } : s));
      await searchEuropeana(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'dpla' ? { ...s, status: 'searching' as const } : s));
      await searchDPLA(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'smk' ? { ...s, status: 'searching' as const } : s));
      await searchSMK(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'neuberger' ? { ...s, status: 'searching' as const } : s));
      await searchNeuberger(artistName);
      
      setCollectionSources(prev => prev.map(s => s.id === 'akg' ? { ...s, status: 'searching' as const } : s));
      await searchAKG(artistName);
    } finally {
      searchInProgressRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!britishMuseumLoading) updateCollectionSource('british-museum', 'complete', britishMuseumTotal);
  }, [britishMuseumLoading, britishMuseumTotal, updateCollectionSource]);

  useEffect(() => {
    if (!vaLoading) updateCollectionSource('va', 'complete', vaTotal);
  }, [vaLoading, vaTotal, updateCollectionSource]);

  useEffect(() => {
    if (!clevelandLoading) updateCollectionSource('cleveland', 'complete', clevelandTotal);
  }, [clevelandLoading, clevelandTotal, updateCollectionSource]);

  useEffect(() => {
    if (!gettyLoading) updateCollectionSource('getty', 'complete', gettyTotal);
  }, [gettyLoading, gettyTotal, updateCollectionSource]);

  useEffect(() => {
    if (!waltersLoading) updateCollectionSource('walters', 'complete', waltersTotal);
  }, [waltersLoading, waltersTotal, updateCollectionSource]);

  useEffect(() => {
    if (!smithsonianLoading) updateCollectionSource('smithsonian', 'complete', smithsonianTotal);
  }, [smithsonianLoading, smithsonianTotal, updateCollectionSource]);

  useEffect(() => {
    if (!ngaLoading) updateCollectionSource('nga', 'complete', ngaTotal);
  }, [ngaLoading, ngaTotal, updateCollectionSource]);

  useEffect(() => {
    if (!europeanaLoading) updateCollectionSource('europeana', 'complete', europeanaTotal);
  }, [europeanaLoading, europeanaTotal, updateCollectionSource]);

  useEffect(() => {
    if (!dplaLoading) updateCollectionSource('dpla', 'complete', dplaTotal);
  }, [dplaLoading, dplaTotal, updateCollectionSource]);

  useEffect(() => {
    if (!smkLoading) updateCollectionSource('smk', 'complete', smkTotal);
  }, [smkLoading, smkTotal, updateCollectionSource]);

  useEffect(() => {
    if (!neubergerLoading) updateCollectionSource('neuberger', 'complete', neubergerTotal);
  }, [neubergerLoading, neubergerTotal, updateCollectionSource]);

  useEffect(() => {
    if (!akgLoading) updateCollectionSource('akg', 'complete', akgTotal);
  }, [akgLoading, akgTotal, updateCollectionSource]);

  // Track the last searched artist to prevent duplicate searches
  const lastSearchedArtistRef = useRef<string | null>(null);

  useEffect(() => {
    if (open && artist.full_name && artist.full_name !== lastSearchedArtistRef.current) {
      lastSearchedArtistRef.current = artist.full_name;
      runSequentialSearches(artist.full_name);
    }
    if (!open) {
      lastSearchedArtistRef.current = null;
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
    ...britishMuseumObjects.map((obj): CollectionItem => ({
      id: `bm-${obj.id}`,
      title: obj.title,
      date: obj.date,
      medium: obj.medium,
      url: obj.url,
      imageUrl: obj.imageUrl || undefined,
      source: 'british-museum',
      sourceName: 'British Museum',
    })),
    ...vaObjects.map((obj): CollectionItem => ({
      id: `va-${obj.id}`,
      title: obj.title,
      date: obj.date,
      medium: obj.medium,
      url: obj.url,
      imageUrl: obj.imageUrl || undefined,
      source: 'va',
      sourceName: 'V&A',
    })),
    ...clevelandObjects.map((obj): CollectionItem => ({
      id: `cleveland-${obj.id}`,
      title: obj.title,
      date: obj.date,
      medium: obj.medium,
      url: obj.url,
      imageUrl: obj.imageUrl || undefined,
      source: 'cleveland',
      sourceName: 'Cleveland',
    })),
    ...gettyObjects.map((obj): CollectionItem => ({
      id: `getty-${obj.id}`,
      title: obj.title,
      date: obj.date,
      medium: obj.medium,
      url: obj.url,
      imageUrl: obj.imageUrl || undefined,
      source: 'getty',
      sourceName: 'Getty',
    })),
    ...waltersObjects.map((obj): CollectionItem => ({
      id: `walters-${obj.id}`,
      title: obj.title,
      date: obj.date,
      medium: obj.medium,
      url: obj.url,
      imageUrl: obj.imageUrl || undefined,
      source: 'walters',
      sourceName: 'Walters',
    })),
    ...smithsonianResults.map((obj): CollectionItem => ({
      id: `smithsonian-${obj.id}`,
      title: obj.title,
      date: obj.date,
      medium: obj.medium,
      url: obj.sourceUrl || undefined,
      imageUrl: obj.imageUrl || obj.thumbnailUrl || undefined,
      source: 'smithsonian',
      sourceName: 'Smithsonian',
    })),
    ...ngaObjects.map((obj): CollectionItem => ({
      id: `nga-${obj.id}`,
      title: obj.title,
      date: obj.date,
      medium: obj.medium,
      url: obj.url,
      imageUrl: obj.imageUrl || undefined,
      source: 'nga',
      sourceName: 'NGA',
    })),
    ...europeanaObjects.map((obj): CollectionItem => ({
      id: `europeana-${obj.id}`,
      title: obj.title,
      date: obj.date,
      medium: obj.medium,
      url: obj.url,
      imageUrl: obj.imageUrl || undefined,
      source: 'europeana',
      sourceName: 'Europeana',
    })),
    ...dplaResults.map((obj): CollectionItem => ({
      id: `dpla-${obj.id}`,
      title: obj.title,
      date: obj.date,
      medium: obj.medium,
      url: obj.sourceUrl || undefined,
      imageUrl: obj.imageUrl || obj.thumbnailUrl || undefined,
      source: 'dpla',
      sourceName: 'DPLA',
    })),
    ...smkObjects.map((obj): CollectionItem => ({
      id: `smk-${obj.id}`,
      title: obj.title,
      date: obj.date,
      medium: obj.medium,
      url: obj.url,
      imageUrl: obj.imageUrl || undefined,
      source: 'smk',
      sourceName: 'SMK Denmark',
      collection: obj.collection,
    })),
    ...neubergerObjects.map((obj): CollectionItem => ({
      id: obj.id,
      title: obj.title,
      date: obj.date,
      medium: obj.medium,
      url: obj.url,
      imageUrl: obj.imageUrl || undefined,
      source: 'neuberger',
      sourceName: 'Neuberger Museum',
      location: obj.location,
    })),
    ...akgObjects.map((obj): CollectionItem => ({
      id: obj.id,
      title: obj.title,
      date: obj.date,
      medium: obj.medium,
      url: obj.url,
      imageUrl: obj.imageUrl || undefined,
      source: 'akg',
      sourceName: 'Buffalo AKG',
      location: obj.location,
    })),
  ];

  // Filter collection items by selected institutions
  const filteredCollectionItems = useMemo(() => {
    return allCollectionItems.filter(item => selectedInstitutions.has(item.source));
  }, [allCollectionItems, selectedInstitutions]);

  const totalCollectionCount = harvardTotal + rijksTotal + metTotal + momaTotal + tateTotal + aicTotal + ngTotal + guggenheimTotal + whitneyTotal + britishMuseumTotal + vaTotal + clevelandTotal + gettyTotal + waltersTotal + smithsonianTotal + ngaTotal + europeanaTotal + dplaTotal + smkTotal + neubergerTotal + akgTotal;
  const filteredCollectionCount = filteredCollectionItems.length;
  const isCollectionsLoading = harvardLoading || rijksLoading || metLoading || momaLoading || tateLoading || aicLoading || ngLoading || guggenheimLoading || whitneyLoading || britishMuseumLoading || vaLoading || clevelandLoading || gettyLoading || waltersLoading || smithsonianLoading || ngaLoading || europeanaLoading || dplaLoading || smkLoading || neubergerLoading || akgLoading;

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

                  {/* Filter dropdown and source summary */}
                  {!isCollectionsLoading && totalCollectionCount > 0 && (
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex flex-wrap gap-2">
                        {INSTITUTION_OPTIONS.map(inst => {
                          const count = allCollectionItems.filter(item => item.source === inst.id).length;
                          if (count === 0) return null;
                          const isSelected = selectedInstitutions.has(inst.id);
                          return (
                            <Badge 
                              key={inst.id}
                              variant={isSelected ? "default" : "outline"}
                              className={`text-xs cursor-pointer transition-all ${!isSelected ? 'opacity-50' : ''}`}
                              onClick={() => toggleInstitution(inst.id)}
                            >
                              {inst.icon}
                              <span className="ml-1">{inst.name.split(' ')[0]}: {count}</span>
                            </Badge>
                          );
                        })}
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 gap-1">
                            <Filter className="h-3 w-3" />
                            <span className="text-xs">Filter</span>
                            {selectedInstitutions.size < INSTITUTION_OPTIONS.length && (
                              <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                                {selectedInstitutions.size}
                              </Badge>
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-background border shadow-lg z-50">
                          <DropdownMenuLabel className="text-xs">Filter by Institution</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <div className="flex gap-1 px-2 py-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-xs flex-1"
                              onClick={selectAllInstitutions}
                            >
                              Select All
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-xs flex-1"
                              onClick={deselectAllInstitutions}
                            >
                              Clear
                            </Button>
                          </div>
                          <DropdownMenuSeparator />
                          {INSTITUTION_OPTIONS.map(inst => {
                            const count = allCollectionItems.filter(item => item.source === inst.id).length;
                            return (
                              <DropdownMenuCheckboxItem
                                key={inst.id}
                                checked={selectedInstitutions.has(inst.id)}
                                onCheckedChange={() => toggleInstitution(inst.id)}
                                disabled={count === 0}
                                className="text-xs"
                              >
                                <span className="flex items-center gap-2">
                                  {inst.icon}
                                  {inst.name}
                                  {count > 0 && (
                                    <span className="ml-auto text-muted-foreground">({count})</span>
                                  )}
                                </span>
                              </DropdownMenuCheckboxItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  
                  {/* Showing filtered count */}
                  {!isCollectionsLoading && totalCollectionCount > 0 && filteredCollectionCount !== totalCollectionCount && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Showing {filteredCollectionCount} of {totalCollectionCount} works
                    </p>
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
                  ) : filteredCollectionItems.length > 0 ? (
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-2 pr-4">
                        {filteredCollectionItems.map((item) => (
                          <CollectionItemCard key={item.id} item={item} />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : totalCollectionCount > 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      No works match the selected filters. Click the badges above or use the filter menu to adjust.
                    </p>
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
