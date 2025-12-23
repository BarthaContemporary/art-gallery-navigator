import { forwardRef, useCallback, useMemo, useState } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { cn } from '@/lib/utils';

interface FlipbookPage {
  pageNumber: number;
  imageUrl?: string;
  textContent?: string;
}

interface FlipbookViewerProps {
  pages: FlipbookPage[];
  pdfUrl?: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  className?: string;
  width?: number;
  height?: number;
}

// Page component for react-pageflip
const Page = forwardRef<HTMLDivElement, { 
  page: FlipbookPage; 
  pageNumber: number;
  pdfUrl?: string;
}>(({ page, pageNumber, pdfUrl }, ref) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <div 
      ref={ref} 
      className="flipbook-page bg-white shadow-lg flex items-center justify-center overflow-hidden"
      data-page-number={pageNumber}
    >
      {page.imageUrl && !imageError ? (
        <>
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="animate-pulse text-muted-foreground">Loading page {pageNumber}...</div>
            </div>
          )}
          <img 
            src={page.imageUrl} 
            alt={`Page ${pageNumber}`}
            className={cn(
              "w-full h-full object-contain transition-opacity duration-300",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-muted/50 to-muted">
          <div className="text-6xl font-light text-muted-foreground/50 mb-4">{pageNumber}</div>
          {page.textContent ? (
            <div className="text-sm text-muted-foreground text-center line-clamp-6 max-w-xs">
              {page.textContent.substring(0, 200)}...
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Page {pageNumber}</div>
          )}
        </div>
      )}
    </div>
  );
});

Page.displayName = 'FlipbookPage';

export function FlipbookViewer({
  pages,
  pdfUrl,
  currentPage,
  onPageChange,
  className,
  width = 400,
  height = 565, // A4 ratio
}: FlipbookViewerProps) {
  const flipbookRef = useCallback((node: any) => {
    if (node) {
      // Store reference for external control
      (window as any).__flipbookRef = node;
    }
  }, []);

  const handleFlip = useCallback((e: any) => {
    const newPage = e.data + 1; // react-pageflip uses 0-indexed
    onPageChange(newPage);
  }, [onPageChange]);

  // Memoize pages to prevent unnecessary re-renders
  const renderedPages = useMemo(() => {
    return pages.map((page, index) => (
      <Page 
        key={page.pageNumber} 
        page={page} 
        pageNumber={page.pageNumber}
        pdfUrl={pdfUrl}
      />
    ));
  }, [pages, pdfUrl]);

  if (pages.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
        <p className="text-muted-foreground">No pages available</p>
      </div>
    );
  }

  return (
    <div className={cn("flipbook-container flex items-center justify-center", className)}>
      <HTMLFlipBook
        ref={flipbookRef}
        width={width}
        height={height}
        size="stretch"
        minWidth={280}
        maxWidth={600}
        minHeight={400}
        maxHeight={850}
        maxShadowOpacity={0.5}
        showCover={true}
        mobileScrollSupport={true}
        onFlip={handleFlip}
        className="flipbook-book"
        style={{}}
        startPage={Math.max(0, currentPage - 1)}
        drawShadow={true}
        flippingTime={600}
        usePortrait={true}
        startZIndex={0}
        autoSize={true}
        clickEventForward={true}
        useMouseEvents={true}
        swipeDistance={30}
        showPageCorners={true}
        disableFlipByClick={false}
      >
        {renderedPages}
      </HTMLFlipBook>
    </div>
  );
}
