import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search, Grid, Maximize, Minimize, Download, ZoomIn, ZoomOut, X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';

// Helper function to safely parse search highlights without dangerouslySetInnerHTML
function parseSearchHighlight(text: string): ReactNode[] {
  if (!text) return [];
  
  // Only allow <mark> tags for search highlighting - strip all other HTML
  const sanitized = text
    .replace(/<(?!\/?(mark)(?=>|\s.*>))\/?.*?>/gi, '') // Remove all tags except <mark>
    .replace(/<mark>/gi, '\u0001') // Use control chars as markers
    .replace(/<\/mark>/gi, '\u0002');
  
  const parts = sanitized.split(/(\u0001.*?\u0002)/g);
  
  return parts.map((part, i) => {
    if (part.startsWith('\u0001') && part.endsWith('\u0002')) {
      const content = part.slice(1, -1);
      return <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">{content}</mark>;
    }
    return part;
  }).filter(Boolean);
}

interface FlipbookPage {
  pageNumber: number;
  imageUrl?: string;
  textContent?: string;
}

// PDF.js loader - shared with FlipbookViewer
let pdfjsLoadPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
  if (pdfjsLoadPromise) return pdfjsLoadPromise;

  pdfjsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(lib);
      } else {
        reject(new Error('PDF.js failed to initialize'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js'));
    document.head.appendChild(script);
  });

  return pdfjsLoadPromise;
}

interface ThumbnailProps {
  page: FlipbookPage;
  pdfUrl?: string;
  isActive: boolean;
  onClick: () => void;
}

function Thumbnail({ page, pdfUrl, isActive, onClick }: ThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'rendered' | 'error'>('idle');

  useEffect(() => {
    if (page.imageUrl || !pdfUrl || status !== 'idle') return;

    let cancelled = false;

    const renderThumbnail = async () => {
      setStatus('loading');
      try {
        const pdfjsLib = await loadPdfJs();
        if (cancelled) return;

        const doc = await pdfjsLib.getDocument(pdfUrl).promise;
        if (cancelled) return;

        const pdfPage = await doc.getPage(page.pageNumber);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const viewport = pdfPage.getViewport({ scale: 0.3 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await pdfPage.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        if (!cancelled) {
          setStatus('rendered');
        }
      } catch (err) {
        console.error('Failed to render thumbnail:', err);
        if (!cancelled) {
          setStatus('error');
        }
      }
    };

    renderThumbnail();

    return () => {
      cancelled = true;
    };
  }, [page.pageNumber, page.imageUrl, pdfUrl, status]);

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative aspect-[3/4] rounded-md overflow-hidden border-2 transition-all",
        isActive 
          ? "border-primary ring-2 ring-primary/20" 
          : "border-border hover:border-primary/50"
      )}
    >
      {page.imageUrl ? (
        <img 
          src={page.imageUrl} 
          alt={`Page ${page.pageNumber}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : status === 'rendered' ? (
        <canvas ref={canvasRef} className="w-full h-full object-cover" />
      ) : (
        <>
          <canvas ref={canvasRef} className="w-full h-full object-cover hidden" />
          <div className="w-full h-full bg-muted flex items-center justify-center">
            {status === 'error' ? (
              <span className="text-lg font-medium text-muted-foreground">{page.pageNumber}</span>
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-1 text-center">
        {page.pageNumber}
      </div>
    </button>
  );
}

interface FlipbookControlsProps {
  pages: FlipbookPage[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSearch: (query: string) => void;
  searchResults: Array<{ pageNumber: number; headline: string }>;
  isSearching: boolean;
  onDownloadClick: () => void;
  downloadGateEnabled: boolean;
  publicationTitle: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  pdfUrl?: string;
}

export function FlipbookControls({
  pages,
  currentPage,
  totalPages,
  onPageChange,
  onSearch,
  searchResults,
  isSearching,
  onDownloadClick,
  downloadGateEnabled,
  publicationTitle,
  zoom,
  onZoomChange,
  pdfUrl,
}: FlipbookControlsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Debounce search query for live search
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Live search effect - triggers search as user types
  useEffect(() => {
    const trimmedQuery = debouncedSearchQuery.trim();
    if (trimmedQuery.length >= 2) {
      setLastSearchQuery(trimmedQuery);
      setHasSearched(true);
      onSearch(trimmedQuery);
    } else if (trimmedQuery === '' && hasSearched) {
      setLastSearchQuery('');
      setHasSearched(false);
      onSearch('');
    }
  }, [debouncedSearchQuery, onSearch, hasSearched]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Optional: still allow form submission for accessibility
    if (searchQuery.trim().length >= 2) {
      setLastSearchQuery(searchQuery.trim());
      setHasSearched(true);
      onSearch(searchQuery.trim());
    }
  };

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setLastSearchQuery('');
    setHasSearched(false);
    onSearch('');
  }, [onSearch]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      // Move by 2 for spread view (1 -> 1, 3 -> 1, 5 -> 3, etc.)
      const newPage = currentPage <= 2 ? 1 : currentPage - 2;
      onPageChange(newPage);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      // Move by 2 for spread view (1 -> 3, 3 -> 5, etc.)
      const newPage = currentPage === 1 ? 3 : Math.min(currentPage + 2, totalPages);
      onPageChange(newPage);
    }
  };

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= totalPages) {
      onPageChange(value);
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Zoom levels: 50%, 75%, 100%, 125%, 150%, 200%, 250%, 300%, 400%
  const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
  
  const handleZoomIn = () => {
    const currentIdx = zoomLevels.findIndex(z => z >= zoom);
    const nextIdx = currentIdx < zoomLevels.length - 1 ? currentIdx + 1 : currentIdx;
    onZoomChange(zoomLevels[nextIdx]);
  };
  
  const handleZoomOut = () => {
    const currentIdx = zoomLevels.findIndex(z => z >= zoom);
    const prevIdx = currentIdx > 0 ? currentIdx - 1 : 0;
    onZoomChange(zoomLevels[prevIdx]);
  };
  
  const handleZoomReset = () => onZoomChange(1);
  
  // Pan mode indicator (above 150%)
  const isPanMode = zoom > 1.5;

  return (
    <div className="flipbook-controls space-y-4">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-background/95 backdrop-blur-sm border rounded-lg shadow-sm">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-2 text-sm">
            <Input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={handlePageInput}
              className="w-16 h-8 text-center"
              aria-label="Current page"
            />
            <span className="text-muted-foreground">of {totalPages}</span>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Search - Live search as you type */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search (min 2 chars)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-48 sm:w-56 h-8"
            />
            {isSearching && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </form>

        {/* Tools */}
        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={zoom <= 0.5} aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleZoomReset} 
            className={cn("text-xs px-2", isPanMode && "text-primary font-medium")}
            title={isPanMode ? "Pan mode active - drag to navigate" : "Click to reset zoom"}
          >
            {Math.round(zoom * 100)}%
            {isPanMode && <span className="ml-1 text-[10px] opacity-70">Pan</span>}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={zoom >= 4} aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>

          {/* Thumbnails */}
          <Sheet open={thumbnailsOpen} onOpenChange={setThumbnailsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="View thumbnails">
                <Grid className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>Page Thumbnails</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-100px)] mt-4">
                <div className="grid grid-cols-2 gap-3 pr-4">
                  {/* First page on its own row, right-aligned */}
                  {pages.length > 0 && (
                    <div className="col-span-2 flex justify-end">
                      <div className="w-[calc(50%-6px)]">
                        <Thumbnail
                          page={pages[0]}
                          pdfUrl={pdfUrl}
                          isActive={currentPage === pages[0].pageNumber}
                          onClick={() => {
                            onPageChange(pages[0].pageNumber);
                            setThumbnailsOpen(false);
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {/* Remaining pages in 2-column grid */}
                  {pages.slice(1).map((page) => (
                    <Thumbnail
                      key={page.pageNumber}
                      page={page}
                      pdfUrl={pdfUrl}
                      isActive={currentPage === page.pageNumber}
                      onClick={() => {
                        onPageChange(page.pageNumber);
                        setThumbnailsOpen(false);
                      }}
                    />
                  ))}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          {/* Fullscreen */}
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} aria-label="Toggle fullscreen">
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>

          {/* Download */}
          <Button variant="default" size="sm" onClick={onDownloadClick} className="ml-2">
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* Search results panel */}
      {(isSearching || hasSearched) && (
        <div className="bg-background border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium flex items-center gap-2">
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching for "{lastSearchQuery}"...
                </>
              ) : searchResults.length > 0 ? (
                <>
                  <Search className="h-4 w-4" />
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{lastSearchQuery}"
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  No results for "{lastSearchQuery}"
                </>
              )}
            </h3>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleClearSearch}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {!isSearching && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Try searching for different keywords. Make sure the publication has been fully processed for text indexing.
            </p>
          )}
          
          {searchResults.length > 0 && (
            <ScrollArea className="h-auto max-h-[50vh] overflow-auto">
              <div className="space-y-2 pr-4">
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => onPageChange(result.pageNumber)}
                    className="w-full text-left p-3 rounded-md border hover:bg-muted hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Page {result.pageNumber}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-sm text-muted-foreground line-clamp-2">
                      {parseSearchHighlight(result.headline)}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
