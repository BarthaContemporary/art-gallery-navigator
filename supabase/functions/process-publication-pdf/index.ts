import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocumentProxy, extractText } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessPublicationRequest {
  publicationId: string;
  pdfUrl: string;
}

// OCR text from a page image using OpenAI GPT-4 Vision
async function ocrPageWithOpenAI(
  imageBase64: string,
  pageNumber: number,
  openAIApiKey: string
): Promise<string> {
  try {
    console.log(`[OCR] Sending page ${pageNumber} to GPT-4 Vision for OCR...`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an OCR assistant. Extract and return ONLY the text content from the provided image. Return plain text, preserving paragraph structure. No formatting markers, no explanations, just the text.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`,
                  detail: 'high'
                }
              },
              {
                type: 'text',
                text: 'Extract all text from this page image.'
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[OCR] OpenAI API error for page ${pageNumber}:`, response.status, errorText);
      return '';
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content || '';
    console.log(`[OCR] Extracted ${extractedText.length} characters from page ${pageNumber}`);
    return extractedText;
  } catch (error) {
    console.warn(`[OCR] Error processing page ${pageNumber}:`, error);
    return '';
  }
}

// Render a PDF page to an image using pdf.js canvas rendering
async function renderPageToImage(
  pdfData: Uint8Array,
  pageNumber: number,
  scale: number = 1.0
): Promise<{ base64: string; width: number; height: number } | null> {
  try {
    // Import pdf.js for canvas rendering
    const pdfjsLib = await import('https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs');
    
    // Set worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs';
    
    // Load the document
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageNumber);
    
    const viewport = page.getViewport({ scale });
    
    // Create a canvas (using Deno's canvas support via offscreen canvas)
    const { createCanvas } = await import('https://deno.land/x/canvas@v1.4.2/mod.ts');
    const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
    const context = canvas.getContext('2d');
    
    // Render the page
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    // Convert to base64 PNG
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.replace('data:image/png;base64,', '');
    
    return {
      base64,
      width: Math.floor(viewport.width),
      height: Math.floor(viewport.height)
    };
  } catch (error) {
    console.warn(`[Render] Failed to render page ${pageNumber}:`, error);
    return null;
  }
}

// Background processing function
async function processPublicationInBackground(publicationId: string, pdfUrl: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`[Background] Starting processing for publication ${publicationId}`);
    const startTime = Date.now();

    // Update status to processing
    await supabase
      .from('publications')
      .update({ 
        processing_status: 'processing',
        processing_error: null 
      })
      .eq('id', publicationId);

    // STEP 1: Delete existing page records FIRST
    console.log('[Background] Deleting existing page records...');
    const { error: deleteError } = await supabase
      .from('publication_pages')
      .delete()
      .eq('publication_id', publicationId);

    if (deleteError) {
      console.error('[Background] CRITICAL: Failed to delete existing pages:', deleteError);
      throw new Error(`Failed to delete existing pages: ${deleteError.message}`);
    }
    console.log(`[Background] Successfully deleted existing page records (${Date.now() - startTime}ms)`);

    // Small delay to ensure database consistency
    await new Promise(resolve => setTimeout(resolve, 100));

    // STEP 2: Fetch the PDF
    console.log('[Background] Fetching PDF from URL...');
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfData = new Uint8Array(pdfBuffer);
    console.log(`[Background] PDF fetched, size: ${pdfBuffer.byteLength} bytes (${Date.now() - startTime}ms)`);

    // STEP 3: Load PDF using unpdf for text extraction
    console.log('[Background] Loading PDF document for text extraction...');
    const pdf = await getDocumentProxy(pdfData);
    const pageCount = pdf.numPages;
    
    console.log(`[Background] PDF has ${pageCount} pages (${Date.now() - startTime}ms)`);

    // Update publication with page count immediately
    await supabase
      .from('publications')
      .update({ page_count: pageCount })
      .eq('id', publicationId);

    // STEP 4: Extract all text using unpdf
    console.log('[Background] Extracting text from all pages...');
    let allPageTexts: string[] = [];
    try {
      const { text } = await extractText(pdfData, { mergePages: false });
      allPageTexts = text || [];
      console.log(`[Background] Text extraction complete for ${allPageTexts.length} pages (${Date.now() - startTime}ms)`);
    } catch (textError) {
      console.warn('[Background] Warning: Could not extract text from PDF:', textError);
      allPageTexts = new Array(pageCount).fill('');
    }

    // STEP 5: Create page records (text only first, thumbnails later)
    const pageRecords = [];
    const MIN_TEXT_THRESHOLD = 50;
    let totalTextLength = 0;

    for (let i = 1; i <= pageCount; i++) {
      const pageText = (allPageTexts[i - 1] || '').trim();
      totalTextLength += pageText.length;

      pageRecords.push({
        publication_id: publicationId,
        page_number: i,
        text_content: pageText,
        render_low_url: null,
        render_high_url: null,
      });
    }

    console.log(`[Background] Total characters extracted: ${totalTextLength} (${Date.now() - startTime}ms)`);

    // STEP 6: Insert pages in batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < pageRecords.length; i += BATCH_SIZE) {
      const batch = pageRecords.slice(i, i + BATCH_SIZE);
      const { error: pagesError } = await supabase
        .from('publication_pages')
        .insert(batch);

      if (pagesError) {
        console.error(`[Background] Error inserting pages batch ${i}-${i + batch.length}:`, pagesError);
        throw new Error(`Failed to create page records: ${pagesError.message}`);
      }
      console.log(`[Background] Inserted pages ${i + 1}-${i + batch.length} of ${pageRecords.length}`);
    }

    console.log(`[Background] Created ${pageCount} page records (${Date.now() - startTime}ms)`);

    // STEP 7: Try to generate thumbnails for first few pages (for preview)
    // This is optional and we'll try our best, but won't fail the whole process
    console.log('[Background] Attempting to generate page thumbnails...');
    const MAX_THUMBNAIL_PAGES = Math.min(pageCount, 10); // First 10 pages for thumbnails
    
    for (let pageNum = 1; pageNum <= MAX_THUMBNAIL_PAGES; pageNum++) {
      try {
        // Try rendering the page to image
        const rendered = await renderPageToImage(pdfData, pageNum, 0.5); // Low res for thumbnails
        
        if (rendered && rendered.base64) {
          // Upload to storage
          const thumbnailPath = `${publicationId}/thumbnails/page-${pageNum}.png`;
          const imageBytes = Uint8Array.from(atob(rendered.base64), c => c.charCodeAt(0));
          
          const { error: uploadError } = await supabase.storage
            .from('publications')
            .upload(thumbnailPath, imageBytes, {
              contentType: 'image/png',
              upsert: true
            });

          if (!uploadError) {
            // Get public URL
            const { data: urlData } = supabase.storage
              .from('publications')
              .getPublicUrl(thumbnailPath);

            // Update the page record with thumbnail URL
            if (urlData?.publicUrl) {
              await supabase
                .from('publication_pages')
                .update({ render_low_url: urlData.publicUrl })
                .eq('publication_id', publicationId)
                .eq('page_number', pageNum);
              
              console.log(`[Background] Generated thumbnail for page ${pageNum}`);
            }
          } else {
            console.warn(`[Background] Failed to upload thumbnail for page ${pageNum}:`, uploadError);
          }
        }
      } catch (thumbError) {
        console.warn(`[Background] Could not generate thumbnail for page ${pageNum}:`, thumbError);
        // Continue with other pages
      }
    }

    // STEP 8: OCR for pages with sparse text (if OpenAI key available)
    if (openAIApiKey) {
      const sparseTextPages = pageRecords.filter(p => (p.text_content?.length || 0) < MIN_TEXT_THRESHOLD);
      
      if (sparseTextPages.length > 0) {
        console.log(`[Background] ${sparseTextPages.length} pages have sparse text, attempting OCR...`);
        
        // OCR first 5 sparse pages max to avoid timeout
        const pagesToOCR = sparseTextPages.slice(0, 5);
        
        for (const page of pagesToOCR) {
          try {
            // First try to render the page to an image
            const rendered = await renderPageToImage(pdfData, page.page_number, 1.5);
            
            if (rendered && rendered.base64) {
              const ocrText = await ocrPageWithOpenAI(rendered.base64, page.page_number, openAIApiKey);
              
              if (ocrText && ocrText.length > 10) {
                // Update the page with OCR text
                await supabase
                  .from('publication_pages')
                  .update({ text_content: ocrText })
                  .eq('publication_id', publicationId)
                  .eq('page_number', page.page_number);
                
                console.log(`[Background] Updated page ${page.page_number} with OCR text (${ocrText.length} chars)`);
              }
            }
          } catch (ocrError) {
            console.warn(`[Background] OCR failed for page ${page.page_number}:`, ocrError);
          }
        }
      }
    }

    // STEP 9: Update publication as completed
    const { error: updateError } = await supabase
      .from('publications')
      .update({ 
        processing_status: 'completed',
        processing_error: null
      })
      .eq('id', publicationId);

    if (updateError) {
      throw new Error(`Failed to update publication status: ${updateError.message}`);
    }

    console.log(`[Background] Publication processing completed in ${Date.now() - startTime}ms`);

  } catch (error) {
    console.error('[Background] Error processing publication:', error);

    // Update status to failed
    try {
      await supabase
        .from('publications')
        .update({ 
          processing_status: 'failed',
          processing_error: error.message 
        })
        .eq('id', publicationId);
    } catch (e) {
      console.error('[Background] Failed to update error status:', e);
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { publicationId, pdfUrl }: ProcessPublicationRequest = await req.json();

    if (!pdfUrl) {
      throw new Error(`Invalid URL: '${pdfUrl}'`);
    }

    if (!publicationId) {
      throw new Error('Missing publicationId');
    }

    console.log(`Received request to process publication ${publicationId}`);

    // Start background processing using EdgeRuntime.waitUntil
    EdgeRuntime.waitUntil(processPublicationInBackground(publicationId, pdfUrl));

    // Return immediate response - processing continues in background
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'PDF processing started in background',
        publicationId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 202
      }
    );

  } catch (error) {
    console.error('Error starting publication processing:', error);

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
