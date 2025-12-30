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

interface TOCSection {
  title: string;
  pageNumber: number;
}

interface KeywordEntry {
  term: string;
  pages: number[];
}

// Generate Cloudinary URL for a specific PDF page
function getCloudinaryPageUrl(
  pdfUrl: string, 
  pageNumber: number, 
  cloudName: string,
  size: 'thumbnail' | 'full' = 'thumbnail'
): string {
  // Cloudinary PDF page transformation
  // Format: /image/upload/pg_{page},w_{width},f_auto,q_auto/{source_url}
  const width = size === 'thumbnail' ? 400 : 1200;
  const quality = size === 'thumbnail' ? 'auto:low' : 'auto:good';
  
  // Use Cloudinary fetch to transform the remote PDF
  const encodedUrl = encodeURIComponent(pdfUrl);
  return `https://res.cloudinary.com/${cloudName}/image/fetch/pg_${pageNumber},w_${width},f_jpg,q_${quality}/${encodedUrl}`;
}

// Verify and pre-warm a Cloudinary URL (forces generation)
async function verifyCloudinaryUrl(url: string, retries = 3): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      // Use GET instead of HEAD to force Cloudinary to actually generate the image
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
        // Consume the body to complete the request
        await response.arrayBuffer();
        return true;
      }
      // Wait before retry
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch {
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  return false;
}

// Pre-warm Cloudinary URL for OCR (ensures image is ready before sending to OpenAI)
async function prewarmCloudinaryImage(url: string): Promise<boolean> {
  try {
    // Fetch the full image to force Cloudinary to generate it
    const response = await fetch(url);
    if (response.ok) {
      await response.arrayBuffer();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// OCR text from a page image using OpenAI GPT-4 Vision
async function ocrPageWithOpenAI(
  imageUrl: string,
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
                  url: imageUrl,
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

// Generate TOC using OpenAI
async function generateTOC(
  pageTexts: { pageNumber: number; text: string }[],
  openAIApiKey: string
): Promise<TOCSection[]> {
  try {
    console.log('[TOC] Generating table of contents...');
    
    // Prepare a summary of each page (first 500 chars per page, max 30 pages)
    const pageSummaries = pageTexts
      .slice(0, 30)
      .map(p => `Page ${p.pageNumber}: ${p.text.substring(0, 500)}`)
      .join('\n\n');
    
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
            content: 'You analyze document content and create structured tables of contents. Return valid JSON only.'
          },
          {
            role: 'user',
            content: `Analyze this publication content and create a table of contents. Identify major sections, chapters, or topics and their starting page numbers.

Return JSON format: {"sections": [{"title": "Section Title", "pageNumber": 1}, ...]}

If you cannot identify clear sections, create logical groupings based on content themes.

Content:
${pageSummaries}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.warn('[TOC] OpenAI API error:', await response.text());
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`[TOC] Generated ${parsed.sections?.length || 0} sections`);
      return parsed.sections || [];
    }
    return [];
  } catch (error) {
    console.warn('[TOC] Error generating TOC:', error);
    return [];
  }
}

// Generate keyword index using OpenAI
async function generateKeywordIndex(
  pageTexts: { pageNumber: number; text: string }[],
  openAIApiKey: string
): Promise<KeywordEntry[]> {
  try {
    console.log('[INDEX] Generating keyword index...');
    
    // Combine all text with page markers
    const allText = pageTexts
      .map(p => `[PAGE ${p.pageNumber}]\n${p.text.substring(0, 1000)}`)
      .join('\n\n');
    
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
            content: 'You extract key terms, names, and concepts from documents for indexing. Return valid JSON only.'
          },
          {
            role: 'user',
            content: `Extract the most important keywords, names, places, and concepts from this publication for search indexing and SEO.

For each term, list all page numbers where it appears.

Return JSON format: {"terms": [{"term": "Keyword", "pages": [1, 5, 12]}, ...]}

Focus on: proper nouns, technical terms, key concepts, important dates, locations, and recurring themes.
Limit to the 50 most important terms.

Content:
${allText.substring(0, 15000)}`
          }
        ],
        max_tokens: 3000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.warn('[INDEX] OpenAI API error:', await response.text());
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`[INDEX] Generated ${parsed.terms?.length || 0} keyword entries`);
      return parsed.terms || [];
    }
    return [];
  } catch (error) {
    console.warn('[INDEX] Error generating index:', error);
    return [];
  }
}

// Generate summary using OpenAI
async function generateSummary(
  pageTexts: { pageNumber: number; text: string }[],
  openAIApiKey: string
): Promise<string> {
  try {
    console.log('[SUMMARY] Generating publication summary...');
    
    // Combine first few pages for summary
    const contentForSummary = pageTexts
      .slice(0, 10)
      .map(p => p.text)
      .join('\n\n')
      .substring(0, 10000);
    
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
            content: 'You create concise, SEO-friendly summaries of documents.'
          },
          {
            role: 'user',
            content: `Create a concise summary of this publication for use as a meta description. 
The summary should be 150-200 characters, engaging, and include key topics.

Content:
${contentForSummary}`
          }
        ],
        max_tokens: 200,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      console.warn('[SUMMARY] OpenAI API error:', await response.text());
      return '';
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim() || '';
    console.log(`[SUMMARY] Generated summary: ${summary.length} chars`);
    return summary;
  } catch (error) {
    console.warn('[SUMMARY] Error generating summary:', error);
    return '';
  }
}

// Background processing function
async function processPublicationInBackground(publicationId: string, pdfUrl: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  const cloudinaryCloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`[Background] Starting processing for publication ${publicationId}`);
    console.log(`[Background] Cloudinary cloud name: ${cloudinaryCloudName ? 'configured' : 'MISSING'}`);
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

    // STEP 5: Generate Cloudinary thumbnail URLs for all pages
    console.log('[Background] Generating Cloudinary page thumbnail URLs...');
    const pageRecords = [];
    const MIN_TEXT_THRESHOLD = 50;
    let totalTextLength = 0;
    const pageTextsForAI: { pageNumber: number; text: string }[] = [];

    for (let i = 1; i <= pageCount; i++) {
      const pageText = (allPageTexts[i - 1] || '').trim();
      totalTextLength += pageText.length;

      // Generate Cloudinary URLs for this page
      let thumbnailUrl: string | null = null;
      let fullUrl: string | null = null;
      
      if (cloudinaryCloudName) {
        thumbnailUrl = getCloudinaryPageUrl(pdfUrl, i, cloudinaryCloudName, 'thumbnail');
        fullUrl = getCloudinaryPageUrl(pdfUrl, i, cloudinaryCloudName, 'full');
      }

      pageRecords.push({
        publication_id: publicationId,
        page_number: i,
        text_content: pageText,
        render_low_url: thumbnailUrl,
        render_high_url: fullUrl,
      });
      
      pageTextsForAI.push({ pageNumber: i, text: pageText });
    }

    console.log(`[Background] Total characters extracted: ${totalTextLength} (${Date.now() - startTime}ms)`);
    
    // Verify first page thumbnail is accessible
    if (cloudinaryCloudName && pageRecords.length > 0 && pageRecords[0].render_low_url) {
      console.log('[Background] Verifying Cloudinary thumbnail generation...');
      const isValid = await verifyCloudinaryUrl(pageRecords[0].render_low_url);
      if (isValid) {
        console.log('[Background] ✓ Cloudinary thumbnails verified working');
      } else {
        console.warn('[Background] ⚠ Cloudinary thumbnail verification failed - URLs may not work');
      }
    }

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

    console.log(`[Background] Created ${pageCount} page records with Cloudinary URLs (${Date.now() - startTime}ms)`);

    // STEP 7: OCR for pages with sparse text (if OpenAI key available)
    if (openAIApiKey && cloudinaryCloudName) {
      const sparseTextPages = pageRecords.filter(p => (p.text_content?.length || 0) < MIN_TEXT_THRESHOLD);
      
      if (sparseTextPages.length > 0) {
        console.log(`[Background] ${sparseTextPages.length} pages have sparse text, attempting OCR...`);
        
        // Process in batches of 10 to avoid timeout
        const OCR_BATCH_SIZE = 10;
        const maxOcrPages = Math.min(sparseTextPages.length, 30); // Limit OCR to 30 pages max
        
        for (let batchStart = 0; batchStart < maxOcrPages; batchStart += OCR_BATCH_SIZE) {
          const batch = sparseTextPages.slice(batchStart, Math.min(batchStart + OCR_BATCH_SIZE, maxOcrPages));
          console.log(`[Background] Processing OCR batch ${batchStart + 1}-${batchStart + batch.length} of ${maxOcrPages}`);
          
          for (const page of batch) {
            try {
              // Use the Cloudinary full-res URL for OCR (better quality)
              const ocrImageUrl = page.render_high_url || page.render_low_url;
              
              if (ocrImageUrl) {
                // Pre-warm the Cloudinary image before sending to OpenAI
                console.log(`[OCR] Pre-warming Cloudinary image for page ${page.page_number}...`);
                const prewarmed = await prewarmCloudinaryImage(ocrImageUrl);
                
                if (!prewarmed) {
                  console.warn(`[OCR] Failed to pre-warm image for page ${page.page_number}, skipping OCR`);
                  continue;
                }
                
                // Small delay to ensure Cloudinary has cached the image
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const ocrText = await ocrPageWithOpenAI(ocrImageUrl, page.page_number, openAIApiKey);
                if (ocrText && ocrText.length > 10) {
                  await supabase
                    .from('publication_pages')
                    .update({ text_content: ocrText })
                    .eq('publication_id', publicationId)
                    .eq('page_number', page.page_number);
                  
                  // Update local record for AI processing
                  const idx = pageTextsForAI.findIndex(p => p.pageNumber === page.page_number);
                  if (idx !== -1) {
                    pageTextsForAI[idx].text = ocrText;
                  }
                  
                  console.log(`[Background] Updated page ${page.page_number} with OCR text (${ocrText.length} chars)`);
                }
              }
            } catch (ocrError) {
              console.warn(`[Background] OCR failed for page ${page.page_number}:`, ocrError);
            }
          }
        }
      }

      // STEP 8: Generate TOC, Keyword Index, and Summary
      console.log('[Background] Generating AI content (TOC, Index, Summary)...');
      
      // Run all AI generation in parallel
      const [toc, keywordIndex, summary] = await Promise.all([
        generateTOC(pageTextsForAI, openAIApiKey),
        generateKeywordIndex(pageTextsForAI, openAIApiKey),
        generateSummary(pageTextsForAI, openAIApiKey),
      ]);
      
      // Update publication with AI-generated content
      const aiUpdateData: Record<string, any> = {};
      if (toc && toc.length > 0) {
        aiUpdateData.toc = { sections: toc };
      }
      if (keywordIndex && keywordIndex.length > 0) {
        aiUpdateData.keyword_index = { terms: keywordIndex };
      }
      if (summary) {
        aiUpdateData.full_text_summary = summary;
      }
      
      if (Object.keys(aiUpdateData).length > 0) {
        await supabase
          .from('publications')
          .update(aiUpdateData)
          .eq('id', publicationId);
        console.log(`[Background] Saved AI content: TOC=${toc?.length || 0} sections, Index=${keywordIndex?.length || 0} terms, Summary=${summary?.length || 0} chars`);
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
