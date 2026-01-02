import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  Building2, 
  Landmark, 
  Columns, 
  Square, 
  Frame, 
  Home, 
  Castle, 
  Building, 
  GalleryHorizontal,
  Newspaper,
  CheckCircle2,
  Loader2,
  Clock,
  Library,
  Globe,
  Archive,
  BookOpen,
  Palette,
  Crown
} from "lucide-react";

export interface SearchSource {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: 'pending' | 'searching' | 'complete' | 'error';
  resultCount?: number;
}

interface SearchProgressIndicatorProps {
  sources: SearchSource[];
  variant?: 'media' | 'collections';
}

export function SearchProgressIndicator({ sources, variant = 'collections' }: SearchProgressIndicatorProps) {
  const completedCount = sources.filter(s => s.status === 'complete' || s.status === 'error').length;
  const totalCount = sources.length;
  const progressPercent = (completedCount / totalCount) * 100;
  
  const currentlySearching = sources.find(s => s.status === 'searching');
  const isComplete = completedCount === totalCount;

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {currentlySearching ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Searching {currentlySearching.name}...</span>
              </>
            ) : isComplete ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-primary" />
                <span>Search complete</span>
              </>
            ) : (
              <>
                <Clock className="h-3 w-3" />
                <span>Preparing search...</span>
              </>
            )}
          </span>
          <span>{completedCount} of {totalCount} sources</span>
        </div>
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      {/* Source status list */}
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source) => (
          <Badge
            key={source.id}
            variant="outline"
            className={cn(
              "text-xs transition-all duration-300 gap-1",
              source.status === 'pending' && "opacity-40",
              source.status === 'searching' && "border-primary bg-primary/5 animate-pulse",
              source.status === 'complete' && source.resultCount && source.resultCount > 0 && "border-primary/50 bg-primary/10",
              source.status === 'complete' && (!source.resultCount || source.resultCount === 0) && "opacity-60",
              source.status === 'error' && "border-destructive/50 opacity-60"
            )}
          >
            {source.status === 'searching' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : source.status === 'complete' ? (
              <CheckCircle2 className="h-3 w-3 text-primary" />
            ) : (
              source.icon
            )}
            <span>{source.name}</span>
            {source.status === 'complete' && source.resultCount !== undefined && (
              <span className="ml-0.5 font-medium">{source.resultCount}</span>
            )}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// Helper function to create media sources configuration
export function createMediaSources(): SearchSource[] {
  return [
    { id: 'guardian', name: 'The Guardian', icon: <Newspaper className="h-3 w-3" />, status: 'pending' },
    { id: 'newsapi', name: 'News API', icon: <Newspaper className="h-3 w-3" />, status: 'pending' },
  ];
}

// Helper function to create collection sources configuration
export function createCollectionSources(): SearchSource[] {
  return [
    { id: 'harvard', name: 'Harvard', icon: <Building2 className="h-3 w-3" />, status: 'pending' },
    { id: 'rijksmuseum', name: 'Rijksmuseum', icon: <Landmark className="h-3 w-3" />, status: 'pending' },
    { id: 'met', name: 'MET', icon: <Columns className="h-3 w-3" />, status: 'pending' },
    { id: 'moma', name: 'MoMA', icon: <Square className="h-3 w-3" />, status: 'pending' },
    { id: 'tate', name: 'Tate', icon: <Frame className="h-3 w-3" />, status: 'pending' },
    { id: 'aic', name: 'Art Institute Chicago', icon: <Home className="h-3 w-3" />, status: 'pending' },
    { id: 'national-gallery', name: 'National Gallery', icon: <Castle className="h-3 w-3" />, status: 'pending' },
    { id: 'guggenheim', name: 'Guggenheim', icon: <Building className="h-3 w-3" />, status: 'pending' },
    { id: 'whitney', name: 'Whitney', icon: <GalleryHorizontal className="h-3 w-3" />, status: 'pending' },
    { id: 'british-museum', name: 'British Museum', icon: <Library className="h-3 w-3" />, status: 'pending' },
    { id: 'va', name: 'V&A', icon: <Palette className="h-3 w-3" />, status: 'pending' },
    { id: 'cleveland', name: 'Cleveland', icon: <Building2 className="h-3 w-3" />, status: 'pending' },
    { id: 'getty', name: 'Getty', icon: <Landmark className="h-3 w-3" />, status: 'pending' },
    { id: 'walters', name: 'Walters', icon: <Castle className="h-3 w-3" />, status: 'pending' },
    { id: 'smithsonian', name: 'Smithsonian', icon: <Archive className="h-3 w-3" />, status: 'pending' },
    { id: 'nga', name: 'NGA', icon: <Columns className="h-3 w-3" />, status: 'pending' },
    { id: 'europeana', name: 'Europeana', icon: <Globe className="h-3 w-3" />, status: 'pending' },
    { id: 'dpla', name: 'DPLA', icon: <BookOpen className="h-3 w-3" />, status: 'pending' },
    { id: 'smk', name: 'SMK', icon: <Crown className="h-3 w-3" />, status: 'pending' },
  ];
}
