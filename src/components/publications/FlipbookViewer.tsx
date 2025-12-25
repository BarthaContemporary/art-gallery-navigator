import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { cn } from '@/lib/utils';

// PDF.js types for dynamic loading
interface PDFDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
}

interface PDFPageProxy {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: any }) => { promise: Promise<void> };
}

interface PDFLib {
  getDocument: (url: string) => { promise: Promise<PDFDocumentProxy> };
  GlobalWorkerOptions: { workerSrc: string };
  version: string;
}

// Global PDF.js instance
let pdfjsLib: PDFLib | null = null;
let pdfjsLoadPromise: Promise<PDFLib> | null = null;

// Load PDF.js from CDN
async function loadPdfJs(): Promise<PDFLib> {
  if (pdfjsLib) return pdfjsLib;
  if (pdfjsLoadPromise) return pdfjsLoadPromise;

  pdfjsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        pdfjsLib = lib;
        resolve(lib);
      } else {
        reject(new Error('PDF.js failed to load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js script'));
    document.head.appendChild(script);
  });

  return pdfjsLoadPromise;
}

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

// PDF Page renderer component
const PdfPage = forwardRef<HTMLDivElement, { 
  pageNumber: number;
  pdfDocument: PDFDocumentProxy | null;
  width: number;
  height: number;
}>(({ pageNumber, pdfDocument, width, height }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState(false);
  const renderingRef = useRef(false);

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current || rendered || renderingRef.current) return;

    renderingRef.current = true;

    const renderPage = async () => {
      try {
        const page = await pdfDocument.getPage(pageNumber);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Calculate scale to fit the container
        const viewport = page.getViewport({ scale: 1 });
        const scaleX = width / viewport.width;
        const scaleY = height / viewport.height;
        const scale = Math.min(scaleX, scaleY) * 2; // 2x for retina

        const scaledViewport = page.getViewport({ scale });
        
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        setRendered(true);
      } catch (err) {
        console.error(`Failed to render page ${pageNumber}:`, err);
        setError(true);
      }
    };

    renderPage();
  }, [pdfDocument, pageNumber, width, height, rendered]);

  return (
    <div 
      ref={ref} 
      className="flipbook-page bg-white shadow-lg flex items-center justify-center overflow-hidden"
      data-page-number={pageNumber}
    >
      {error ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-muted/50 to-muted">
          <div className="text-6xl font-light text-muted-foreground/50 mb-4">{pageNumber}</div>
          <div className="text-sm text-muted-foreground">Failed to load page</div>
        </div>
      ) : !rendered ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="animate-pulse text-muted-foreground">Loading page {pageNumber}...</div>
        </div>
      ) : null}
      <canvas 
        ref={canvasRef} 
        className={cn(
          "max-w-full max-h-full object-contain transition-opacity duration-300",
          rendered ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
});

PdfPage.displayName = 'PdfPage';

// Image Page component for pre-rendered images
const ImagePage = forwardRef<HTMLDivElement, { 
  page: FlipbookPage; 
  pageNumber: number;
}>(({ page, pageNumber }, ref) => {
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

ImagePage.displayName = 'ImagePage';

export function FlipbookViewer({
  pages,
  pdfUrl,
  currentPage,
  onPageChange,
  className,
  width = 400,
  height = 565,
}: FlipbookViewerProps) {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  // Load PDF document
  useEffect(() => {
    if (!pdfUrl || pdfDocument) return;

    const loadPdf = async () => {
      setLoadingPdf(true);
      try {
        const lib = await loadPdfJs();
        const loadingTask = lib.getDocument(pdfUrl);
        const doc = await loadingTask.promise;
        setPdfDocument(doc);
      } catch (err) {
        console.error('Failed to load PDF:', err);
        setPdfError(true);
      } finally {
        setLoadingPdf(false);
      }
    };

    loadPdf();
  }, [pdfUrl, pdfDocument]);

  const flipbookRef = useCallback((node: any) => {
    if (node) {
      (window as any).__flipbookRef = node;
    }
  }, []);

  const handleFlip = useCallback((e: any) => {
    const newPage = e.data + 1;
    onPageChange(newPage);
  }, [onPageChange]);

  // Check if we should use PDF rendering or pre-rendered images
  const usePdfRendering = pdfUrl && pdfDocument && pages.every(p => !p.imageUrl);

  // Memoize pages to prevent unnecessary re-renders
  const renderedPages = useMemo(() => {
    if (usePdfRendering && pdfDocument) {
      return pages.map((page) => (
        <PdfPage 
          key={page.pageNumber} 
          pageNumber={page.pageNumber}
          pdfDocument={pdfDocument}
          width={width}
          height={height}
        />
      ));
    }

    return pages.map((page) => (
      <ImagePage 
        key={page.pageNumber} 
        page={page} 
        pageNumber={page.pageNumber}
      />
    ));
  }, [pages, usePdfRendering, pdfDocument, width, height]);

  if (pages.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
        <p className="text-muted-foreground">No pages available</p>
      </div>
    );
  }

  if (loadingPdf) {
    return (
      <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground">Loading document...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flipbook-container flex items-center justify-center", className)}>
      <HTMLFlipBook
        ref={flipbookRef}
        width={width}
        height={height}
        size="fixed"
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
        startPage={0}
        drawShadow={true}
        flippingTime={600}
        usePortrait={false}
        startZIndex={0}
        autoSize={false}
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
