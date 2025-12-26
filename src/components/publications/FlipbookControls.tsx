import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, Grid, Maximize, Minimize, Download, ZoomIn, ZoomOut, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface FlipbookPage {
  pageNumber: number;
  imageUrl?: string;
  textContent?: string;
}

interface ThumbnailProps {
  page: FlipbookPage;
  pdfUrl?: string;
  isActive: boolean;
  onClick: () => void;
}

function Thumbnail({ page, pdfUrl, isActive, onClick }: ThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (page.imageUrl || !pdfUrl || rendered || error) return;

    const renderThumbnail = async () => {
      try {
        const pdfjsLib = (window as any).pdfjsLib;
        if (!pdfjsLib) return;

        const doc = await pdfjsLib.getDocument(pdfUrl).promise;
        const pdfPage = await doc.getPage(page.pageNumber);
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

        setRendered(true);
      } catch (err) {
        console.error('Failed to render thumbnail:', err);
        setError(true);
      }
    };

    renderThumbnail();
  }, [page.pageNumber, page.imageUrl, pdfUrl, rendered, error]);

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
      ) : rendered ? (
        <canvas ref={canvasRef} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-muted flex items-center justify-center">
          {error ? (
            <span className="text-lg font-medium text-muted-foreground">{page.pageNumber}</span>
          ) : (
            <span className="text-sm text-muted-foreground animate-pulse">Loading...</span>
          )}
        </div>
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
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };

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

  const handleZoomIn = () => onZoomChange(Math.min(zoom + 0.25, 2));
  const handleZoomOut = () => onZoomChange(Math.max(zoom - 0.25, 0.5));
  const handleZoomReset = () => onZoomChange(1);

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

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search in document..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-48 h-8"
            />
          </div>
          <Button type="submit" size="sm" variant="secondary" disabled={isSearching}>
            {isSearching ? 'Searching...' : 'Search'}
          </Button>
        </form>

        {/* Tools */}
        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <Button variant="ghost" size="icon" onClick={handleZoomOut} aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleZoomReset} className="text-xs px-2">
            {Math.round(zoom * 100)}%
          </Button>
          <Button variant="ghost" size="icon" onClick={handleZoomIn} aria-label="Zoom in">
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

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="bg-background border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">
              Search Results ({searchResults.length})
            </h3>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onSearch('')}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="max-h-48">
            <div className="space-y-2">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => onPageChange(result.pageNumber)}
                  className="w-full text-left p-2 rounded hover:bg-muted transition-colors"
                >
                  <div className="text-sm font-medium">Page {result.pageNumber}</div>
                  <div 
                    className="text-xs text-muted-foreground line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: result.headline }}
                  />
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
