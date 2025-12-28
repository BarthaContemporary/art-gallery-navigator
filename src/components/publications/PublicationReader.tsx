import { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FlipbookViewer } from './FlipbookViewer';
import { FlipbookControls } from './FlipbookControls';
import { LeadCaptureModal } from './LeadCaptureModal';
import { Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface PublicationReaderProps {
  publicationSlug: string;
}

interface SearchResult {
  pageNumber: number;
  headline: string;
}

export function PublicationReader({ publicationSlug }: PublicationReaderProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [leadCaptureOpen, setLeadCaptureOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const coverUploadedRef = useRef(false);

  // Fetch publication data
  const { data: publication, isLoading: loadingPublication, error: publicationError } = useQuery({
    queryKey: ['publication', publicationSlug],
    queryFn: async () => {
      // Try by slug first
      let { data, error } = await supabase
        .from('publications')
        .select('*')
        .eq('slug', publicationSlug)
        .single();

      // If not found by slug, try by ID
      if (error || !data) {
        const { data: byId, error: idError } = await supabase
          .from('publications')
          .select('*')
          .eq('id', publicationSlug)
          .single();
        
        if (idError) throw idError;
        data = byId;
      }

      return data;
    },
  });

  // Fetch pages
  const { data: pages, isLoading: loadingPages } = useQuery({
    queryKey: ['publication-pages', publication?.id],
    queryFn: async () => {
      if (!publication?.id) return [];

      const { data, error } = await supabase
        .from('publication_pages')
        .select('*')
        .eq('publication_id', publication.id)
        .order('page_number', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!publication?.id,
  });

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          setCurrentPage(prev => Math.max(1, prev - 1));
          break;
        case 'ArrowRight':
          if (publication?.page_count) {
            setCurrentPage(prev => Math.min(publication.page_count, prev + 1));
          }
          break;
        case 'Home':
          setCurrentPage(1);
          break;
        case 'End':
          if (publication?.page_count) {
            setCurrentPage(publication.page_count);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [publication?.page_count]);

  // Handle search
  const handleSearch = useCallback(async (query: string) => {
    if (!publication?.id || !query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .rpc('search_publication_pages', {
          p_publication_id: publication.id,
          p_query: query,
          p_limit: 20,
        });

      if (error) throw error;

      const results = (data || [])
        .map((result: any) => ({
          pageNumber: result.page_number,
          headline: result.headline,
        }))
        .sort((a, b) => a.pageNumber - b.pageNumber);
      
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [publication?.id]);

  // Handle download click
  const handleDownloadClick = () => {
    if (publication?.download_gate_enabled) {
      setLeadCaptureOpen(true);
    } else if (publication?.pdf_url) {
      window.open(publication.pdf_url, '_blank');
    }
  };

  // Handle cover image capture and upload
  const handleCoverReady = useCallback(async (canvas: HTMLCanvasElement) => {
    if (!publication?.id || coverUploadedRef.current) return;
    
    coverUploadedRef.current = true;
    console.log('Cover ready, uploading...');

    try {
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create blob from canvas'));
        }, 'image/jpeg', 0.9);
      });

      // Upload to storage
      const coverPath = `${publication.id}/cover.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('publications')
        .upload(coverPath, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Failed to upload cover:', uploadError);
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('publications')
        .getPublicUrl(coverPath);

      // Update publication with cover URL
      const { error: updateError } = await supabase
        .from('publications')
        .update({ og_image_url: urlData.publicUrl })
        .eq('id', publication.id);

      if (updateError) {
        console.error('Failed to update publication with cover URL:', updateError);
      } else {
        console.log('Cover image uploaded successfully:', urlData.publicUrl);
      }
    } catch (err) {
      console.error('Error uploading cover:', err);
    }
  }, [publication?.id, publication?.og_image_url]);

  // Prepare pages for flipbook
  const flipbookPages = (pages || []).map(page => ({
    pageNumber: page.page_number,
    imageUrl: page.render_high_url || page.render_low_url,
    textContent: page.text_content,
  }));

  if (loadingPublication || loadingPages) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading publication...</p>
        </div>
      </div>
    );
  }

  if (publicationError || !publication) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto mt-8">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Publication not found or is not available.
        </AlertDescription>
      </Alert>
    );
  }

  if (publication.processing_status !== 'completed') {
    return (
      <Alert className="max-w-lg mx-auto mt-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertDescription>
          This publication is currently being processed. Please check back shortly.
        </AlertDescription>
      </Alert>
    );
  }

  const seo = (publication.seo as Record<string, any>) || {};
  const metaTitle = seo.title || publication.title;
  // Use AI-generated summary if available, fall back to description
  const metaDescription = seo.description || (publication as any).full_text_summary || publication.description || `Read ${publication.title}`;
  
  // Parse TOC and keyword index if available
  const toc = (publication as any).toc as { sections?: Array<{ title: string; pageNumber: number }> } | null;
  const keywordIndex = (publication as any).keyword_index as { terms?: Array<{ term: string; pages: number[] }> } | null;
  
  // Combine page text content for SEO (first ~10000 chars)
  const pageTextContent = pages
    ?.map((p: any) => p.text_content || '')
    .join(' ')
    .substring(0, 10000) || '';
  
  // Generate keywords from index
  const metaKeywords = keywordIndex?.terms?.slice(0, 20).map(t => t.term).join(', ') || '';
  
  // Generate TOC string for structured data
  const tocString = toc?.sections?.map(s => s.title).join(', ') || '';
  
  // JSON-LD structured data for search engines and AI
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DigitalDocument',
    name: publication.title,
    description: metaDescription,
    author: publication.author ? { '@type': 'Person', name: publication.author } : undefined,
    datePublished: publication.created_at,
    dateModified: publication.updated_at,
    url: `${window.location.origin}/p/${publication.slug}`,
    image: publication.og_image_url || undefined,
    numberOfPages: publication.page_count,
    text: pageTextContent.substring(0, 5000),
    tableOfContents: tocString || undefined,
    keywords: metaKeywords || undefined,
    inLanguage: 'en',
    isAccessibleForFree: !publication.download_gate_enabled,
  };

  return (
    <>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        {metaKeywords && <meta name="keywords" content={metaKeywords} />}
        {publication.visibility === 'unlisted' && (
          <meta name="robots" content="noindex, nofollow" />
        )}
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`${window.location.origin}/p/${publication.slug}`} />
        {publication.og_image_url && (
          <meta property="og:image" content={publication.og_image_url} />
        )}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <link rel="canonical" href={`${window.location.origin}/p/${publication.slug}`} />
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      </Helmet>
      
      {/* Hidden SEO content for crawlers */}
      <div className="sr-only" aria-hidden="true">
        <h1>{publication.title}</h1>
        {publication.author && <p>By {publication.author}</p>}
        <article>{pageTextContent}</article>
      </div>

      <div className="publication-reader-container max-w-6xl mx-auto px-4 py-6 min-h-screen bg-muted/30">
        {/* Controls */}
        <FlipbookControls
          pages={flipbookPages}
          currentPage={currentPage}
          totalPages={publication.page_count || 0}
          onPageChange={setCurrentPage}
          onSearch={handleSearch}
          searchResults={searchResults}
          isSearching={isSearching}
          onDownloadClick={handleDownloadClick}
          downloadGateEnabled={publication.download_gate_enabled || false}
          publicationTitle={publication.title}
          zoom={zoom}
          onZoomChange={setZoom}
          pdfUrl={publication.pdf_url || undefined}
        />

        {/* Flipbook */}
        <div className="mt-6 flex justify-center overflow-hidden">
          <FlipbookViewer
            pages={flipbookPages}
            pdfUrl={publication.pdf_url || undefined}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onCoverReady={handleCoverReady}
            width={450}
            height={636}
            zoom={zoom}
          />
        </div>

        {/* Title, Subtitle, Author - below flipbook */}
        <div className="mt-8 max-w-2xl mx-auto">
          <h1 className="text-lg font-semibold">{publication.title}</h1>
          {publication.subtitle && (
            <p className="text-muted-foreground mt-1">{publication.subtitle}</p>
          )}
          {publication.author && (
            <p className="text-sm text-muted-foreground mt-2">By {publication.author}</p>
          )}

          {/* Description - Collapsible */}
          {publication.description && (
            <Collapsible className="mt-4">
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group">
                <span>Description</span>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <p className="text-muted-foreground">{publication.description}</p>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>

      {/* Lead capture modal */}
      <LeadCaptureModal
        open={leadCaptureOpen}
        onOpenChange={setLeadCaptureOpen}
        publicationId={publication.id}
        publicationTitle={publication.title}
        defaultOptIn={publication.mailing_list_default_opt_in || false}
      />
    </>
  );
}
