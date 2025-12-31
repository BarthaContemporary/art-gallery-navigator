import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Use Cloudinary's fetch feature to access PDF pages without uploading
// This bypasses the upload size limit by having Cloudinary fetch directly from URL
function getCloudinaryFetchUrl(
  cloudName: string,
  pdfUrl: string,
  pageNumber: number,
  options: { width?: number; quality?: number; format?: string } = {}
): string {
  const { width, quality = 85, format = 'jpg' } = options;
  
  // Encode the PDF URL for use in Cloudinary fetch
  const encodedUrl = encodeURIComponent(pdfUrl);
  
  let transformations = `pg_${pageNumber},q_${quality}`;
  if (width) {
    transformations += `,w_${width}`;
  }
  
  // Use Cloudinary's fetch feature - no upload required!
  return `https://res.cloudinary.com/${cloudName}/image/fetch/${transformations}/${encodedUrl}`;
}

// Get page count by probing Cloudinary fetch URLs
async function getPdfPageCountViaFetch(
  cloudName: string,
  pdfUrl: string
): Promise<{ pageCount: number; width: number; height: number }> {
  console.log('[PageCount] Probing PDF pages via Cloudinary fetch...');
  
  // First check if page 1 works
  const page1Url = getCloudinaryFetchUrl(cloudName, pdfUrl, 1);
  console.log('[PageCount] Testing page 1:', page1Url.substring(0, 100) + '...');
  
  const page1Response = await fetch(page1Url, { method: 'HEAD' });
  if (!page1Response.ok) {
    console.error('[PageCount] Could not access page 1:', page1Response.status);
    throw new Error('Could not access PDF via Cloudinary fetch');
  }
  
  // Try to get dimensions from first page
  let width = 612;
  let height = 792;
  
  try {
    // Fetch page 1 to get dimensions via fl_getinfo
    const infoUrl = `https://res.cloudinary.com/${cloudName}/image/fetch/pg_1,fl_getinfo/${encodeURIComponent(pdfUrl)}`;
    const infoResponse = await fetch(infoUrl);
    if (infoResponse.ok) {
      const infoData = await infoResponse.json();
      if (infoData.input?.width && infoData.input?.height) {
        width = infoData.input.width;
        height = infoData.input.height;
        console.log(`[PageCount] Page dimensions: ${width}x${height}`);
      }
    }
  } catch (e) {
    console.warn('[PageCount] Could not get dimensions, using defaults');
  }
  
  // Binary search for page count
  let low = 1;
  let high = 500;
  let lastValid = 1;
  
  // Quick probes at common page counts
  for (const checkpoint of [10, 25, 50, 100, 200, 300]) {
    const url = getCloudinaryFetchUrl(cloudName, pdfUrl, checkpoint);
    const response = await fetch(url, { method: 'HEAD' });
    if (response.ok) {
      lastValid = checkpoint;
      low = checkpoint;
      console.log(`[PageCount] Page ${checkpoint} exists`);
    } else {
      high = checkpoint;
      console.log(`[PageCount] Page ${checkpoint} doesn't exist, narrowing search`);
      break;
    }
  }
  
  // Binary search between low and high
  while (low < high - 1) {
    const mid = Math.floor((low + high) / 2);
    const url = getCloudinaryFetchUrl(cloudName, pdfUrl, mid);
    const response = await fetch(url, { method: 'HEAD' });
    
    if (response.ok) {
      lastValid = mid;
      low = mid;
    } else {
      high = mid;
    }
  }
  
  // Check high one more time
  const highUrl = getCloudinaryFetchUrl(cloudName, pdfUrl, high);
  const highResponse = await fetch(highUrl, { method: 'HEAD' });
  if (highResponse.ok) {
    lastValid = high;
  }
  
  console.log(`[PageCount] Found ${lastValid} pages`);
  return { pageCount: lastValid, width, height };
}

// Get page dimensions from Cloudinary fetch
async function getPageDimensionsViaFetch(
  cloudName: string,
  pdfUrl: string,
  pageNumber: number
): Promise<{ width: number; height: number }> {
  try {
    const infoUrl = `https://res.cloudinary.com/${cloudName}/image/fetch/pg_${pageNumber},fl_getinfo/${encodeURIComponent(pdfUrl)}`;
    const response = await fetch(infoUrl);
    
    if (response.ok) {
      const data = await response.json();
      if (data.input?.width && data.input?.height) {
        return { width: data.input.width, height: data.input.height };
      }
    }
    
    return { width: 612, height: 792 };
  } catch (e) {
    return { width: 612, height: 792 };
  }
}

// Get Cloudinary URL for a specific PDF page
function getCloudinaryPageUrl(
  cloudName: string,
  publicId: string,
  pageNumber: number,
  options: { width?: number; quality?: number; format?: string } = {}
): string {
  const { width, quality = 80, format = 'jpg' } = options;
  
  let transformations = `pg_${pageNumber},q_${quality}`;
  if (width) {
    transformations += `,w_${width}`;
  }
  
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformations}/${publicId}.${format}`;
}

// Get PDF page count by probing Cloudinary
async function getPdfPageCount(
  cloudName: string,
  publicId: string
): Promise<number> {
  // Binary search to find the page count
  let low = 1;
  let high = 500; // Start with assumption max 500 pages
  let lastValid = 1;
  
  // First check if page 1 exists
  const page1Url = getCloudinaryPageUrl(cloudName, publicId, 1);
  const page1Response = await fetch(page1Url, { method: 'HEAD' });
  if (!page1Response.ok) {
    console.log('[PageCount] Could not access page 1');
    return 0;
  }
  
  // Check page 100, 200, etc. to narrow down quickly
  for (const checkpoint of [10, 50, 100, 200, 300, 500]) {
    const url = getCloudinaryPageUrl(cloudName, publicId, checkpoint);
    const response = await fetch(url, { method: 'HEAD' });
    if (response.ok) {
      lastValid = checkpoint;
      low = checkpoint;
    } else {
      high = checkpoint;
      break;
    }
  }
  
  // Binary search between low and high
  while (low < high - 1) {
    const mid = Math.floor((low + high) / 2);
    const url = getCloudinaryPageUrl(cloudName, publicId, mid);
    const response = await fetch(url, { method: 'HEAD' });
    
    if (response.ok) {
      lastValid = mid;
      low = mid;
    } else {
      high = mid;
    }
  }
  
  // Check high one more time
  const highUrl = getCloudinaryPageUrl(cloudName, publicId, high);
  const highResponse = await fetch(highUrl, { method: 'HEAD' });
  if (highResponse.ok) {
    return high;
  }
  
  return lastValid;
}

// Get page dimensions from Cloudinary
async function getPageDimensions(
  cloudName: string,
  publicId: string,
  pageNumber: number
): Promise<{ width: number; height: number } | null> {
  try {
    // Use Cloudinary's fl_getinfo to get dimensions without downloading
    const infoUrl = `https://res.cloudinary.com/${cloudName}/image/upload/pg_${pageNumber}/fl_getinfo/${publicId}.jpg`;
    const response = await fetch(infoUrl);
    
    if (response.ok) {
      const data = await response.json();
      if (data.input?.width && data.input?.height) {
        return { width: data.input.width, height: data.input.height };
      }
    }
    
    // Fallback: try to get dimensions from HEAD request
    const pageUrl = getCloudinaryPageUrl(cloudName, publicId, pageNumber);
    const headResponse = await fetch(pageUrl, { method: 'HEAD' });
    
    // Default PDF dimensions (US Letter at 72 DPI)
    return { width: 612, height: 792 };
  } catch (error) {
    console.warn(`[Dimensions] Error getting dimensions for page ${pageNumber}:`, error);
    return { width: 612, height: 792 };
  }
}

// OCR a page image using OpenAI GPT-4 Vision
async function ocrPageWithOpenAI(
  imageUrl: string,
  pageNumber: number,
  openAIApiKey: string
): Promise<string> {
  try {
    console.log(`[OCR] Processing page ${pageNumber}...`);
    
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
            content: 'You are an OCR assistant. Extract and return ONLY the text content from the provided image. Return plain text, preserving paragraph structure and line breaks. No formatting markers, no explanations, no commentary - just the raw text as it appears on the page.'
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
                text: 'Extract all visible text from this page.'
              }
            ]
          }
        ],
        max_tokens: 4096,
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
    console.log(`[OCR] Extracted ${extractedText.length} chars from page ${pageNumber}`);
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
    
    const pageSummaries = pageTexts
      .filter(p => p.text.length > 50)
      .slice(0, 30)
      .map(p => `Page ${p.pageNumber}:\n${p.text.substring(0, 500)}`)
      .join('\n\n---\n\n');
    
    if (pageSummaries.length < 100) {
      console.log('[TOC] Not enough text content for TOC');
      return [];
    }
    
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
            content: 'You analyze document content and create structured tables of contents. Return valid JSON only, no markdown formatting.'
          },
          {
            role: 'user',
            content: `Analyze this publication content and create a table of contents. Identify major sections, chapters, or topics with their starting page numbers.

Return JSON: {"sections": [{"title": "Section Title", "pageNumber": 1}, ...]}

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
    
    // Extract JSON from response
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
    
    const allText = pageTexts
      .filter(p => p.text.length > 20)
      .map(p => `[PAGE ${p.pageNumber}]\n${p.text.substring(0, 800)}`)
      .join('\n\n');
    
    if (allText.length < 200) {
      console.log('[INDEX] Not enough text for keyword index');
      return [];
    }
    
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
            content: 'You extract key terms, names, and concepts from documents for indexing. Return valid JSON only, no markdown.'
          },
          {
            role: 'user',
            content: `Extract the most important keywords, names, places, and concepts from this publication for search and SEO.

For each term, list all page numbers where it appears.

Return JSON: {"terms": [{"term": "Keyword", "pages": [1, 5, 12]}, ...]}

Focus on: proper nouns, technical terms, key concepts, important dates, locations, and recurring themes.
Limit to the 50 most important terms.

Content:
${allText.substring(0, 12000)}`
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
    
    const contentForSummary = pageTexts
      .filter(p => p.text.length > 50)
      .slice(0, 10)
      .map(p => p.text)
      .join('\n\n')
      .substring(0, 8000);
    
    if (contentForSummary.length < 100) {
      console.log('[SUMMARY] Not enough text for summary');
      return '';
    }
    
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
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const cloudinaryApiKey = Deno.env.get('CLOUDINARY_API_KEY');
  const cloudinaryApiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`[Process] Starting for publication ${publicationId}`);
    console.log(`[Process] PDF URL: ${pdfUrl}`);
    console.log(`[Process] OpenAI API Key: ${openAIApiKey ? 'Present' : 'Missing'}`);
    console.log(`[Process] Cloudinary: ${cloudName ? 'Configured' : 'Missing'}`);
    const startTime = Date.now();

    // Validate required secrets
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    
    if (!cloudName) {
      throw new Error('Cloudinary cloud name is not configured');
    }

    // Update status to processing
    await supabase
      .from('publications')
      .update({ 
        processing_status: 'processing',
        processing_error: null 
      })
      .eq('id', publicationId);

    // Step 1: Delete existing pages
    console.log('[Process] Deleting existing pages...');
    const { error: deleteError } = await supabase
      .from('publication_pages')
      .delete()
      .eq('publication_id', publicationId);

    if (deleteError) {
      console.error('[Process] Failed to delete existing pages:', deleteError);
    }

    // Step 2: Use Cloudinary FETCH to access PDF pages (no upload required!)
    // This bypasses the 10MB upload limit by having Cloudinary fetch directly from URL
    console.log('[Process] Using Cloudinary fetch to access PDF pages (no upload needed)...');
    
    let pageCount: number;
    let defaultWidth = 612;
    let defaultHeight = 792;
    
    try {
      const pdfInfo = await getPdfPageCountViaFetch(cloudName, pdfUrl);
      pageCount = pdfInfo.pageCount;
      defaultWidth = pdfInfo.width;
      defaultHeight = pdfInfo.height;
      console.log(`[Process] PDF accessible via Cloudinary fetch: ${pageCount} pages, ${defaultWidth}x${defaultHeight}`);
    } catch (error) {
      console.error('[Process] Cloudinary fetch failed:', error);
      throw new Error(`Could not access PDF via Cloudinary: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Save page count (no cloudinary public ID needed for fetch)
    await supabase
      .from('publications')
      .update({ 
        page_count: pageCount
      })
      .eq('id', publicationId);

    console.log(`[Process] Processing ${pageCount} pages... (${Date.now() - startTime}ms)`);

    // Step 3: Process each page - OCR with OpenAI Vision using Cloudinary fetch URLs
    const pageTextsForAI: { pageNumber: number; text: string }[] = [];
    const pageRecords: any[] = [];
    
    // Process in batches to avoid rate limits
    const OCR_BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 1000; // 1 second between batches
    
    for (let batchStart = 0; batchStart < pageCount; batchStart += OCR_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + OCR_BATCH_SIZE, pageCount);
      console.log(`[Process] OCR batch: pages ${batchStart + 1}-${batchEnd} of ${pageCount}`);
      
      const batchPromises = [];
      
      for (let i = batchStart; i < batchEnd; i++) {
        const pageNumber = i + 1;
        
        batchPromises.push((async () => {
          // Get Cloudinary FETCH URLs for this page (no upload required!)
          const thumbnailUrl = getCloudinaryFetchUrl(cloudName, pdfUrl, pageNumber, { width: 300, quality: 70 });
          const fullUrl = getCloudinaryFetchUrl(cloudName, pdfUrl, pageNumber, { quality: 90 });
          
          // Get page dimensions
          const dimensions = await getPageDimensionsViaFetch(cloudName, pdfUrl, pageNumber);
          const width = dimensions.width || defaultWidth;
          const height = dimensions.height || defaultHeight;
          
          // OCR the page using OpenAI Vision
          const textContent = await ocrPageWithOpenAI(fullUrl, pageNumber, openAIApiKey);
          
          return {
            publication_id: publicationId,
            page_number: pageNumber,
            text_content: textContent,
            render_low_url: thumbnailUrl,
            render_high_url: fullUrl,
            width: width,
            height: height,
          };
        })());
      }
      
      const batchResults = await Promise.all(batchPromises);
      pageRecords.push(...batchResults);
      
      for (const record of batchResults) {
        pageTextsForAI.push({ pageNumber: record.page_number, text: record.text_content || '' });
      }
      
      // Progress update
      const progress = Math.round((batchEnd / pageCount) * 100);
      console.log(`[Process] OCR progress: ${progress}% (${batchEnd}/${pageCount})`);
      
      // Delay between batches to respect rate limits
      if (batchEnd < pageCount) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    console.log(`[Process] OCR complete for all ${pageCount} pages (${Date.now() - startTime}ms)`);

    // Step 4: Insert page records in batches
    const INSERT_BATCH_SIZE = 50;
    for (let i = 0; i < pageRecords.length; i += INSERT_BATCH_SIZE) {
      const batch = pageRecords.slice(i, i + INSERT_BATCH_SIZE);
      const { error: pagesError } = await supabase
        .from('publication_pages')
        .insert(batch);

      if (pagesError) {
        console.error(`[Process] Error inserting pages ${i + 1}-${i + batch.length}:`, pagesError);
        throw new Error(`Failed to create page records: ${pagesError.message}`);
      }
      console.log(`[Process] Inserted pages ${i + 1}-${i + batch.length}`);
    }

    // Step 5: Generate AI content (TOC, Index, Summary)
    console.log('[Process] Generating AI content...');
    
    const [toc, keywordIndex, summary] = await Promise.all([
      generateTOC(pageTextsForAI, openAIApiKey),
      generateKeywordIndex(pageTextsForAI, openAIApiKey),
      generateSummary(pageTextsForAI, openAIApiKey),
    ]);
    
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
      console.log(`[Process] Saved AI content: TOC=${toc?.length || 0}, Index=${keywordIndex?.length || 0}, Summary=${summary?.length || 0} chars`);
    }

    // Step 6: Mark as completed
    const { error: updateError } = await supabase
      .from('publications')
      .update({ 
        processing_status: 'completed',
        processing_error: null
      })
      .eq('id', publicationId);

    if (updateError) {
      throw new Error(`Failed to update status: ${updateError.message}`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Process] COMPLETED in ${totalTime}ms (${Math.round(totalTime / 1000)}s)`);
    console.log(`[Process] ${pageCount} pages processed, ${pageTextsForAI.filter(p => p.text.length > 50).length} pages with text`);

  } catch (error) {
    console.error('[Process] FAILED:', error);

    try {
      await supabase
        .from('publications')
        .update({ 
          processing_status: 'failed',
          processing_error: error instanceof Error ? error.message : String(error)
        })
        .eq('id', publicationId);
    } catch (e) {
      console.error('[Process] Failed to update error status:', e);
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { publicationId, pdfUrl }: ProcessPublicationRequest = await req.json();

    if (!pdfUrl) {
      throw new Error(`Invalid PDF URL: '${pdfUrl}'`);
    }

    if (!publicationId) {
      throw new Error('Missing publicationId');
    }

    console.log(`[Request] Processing publication ${publicationId}`);
    console.log(`[Request] PDF URL: ${pdfUrl}`);

    // Start background processing
    EdgeRuntime.waitUntil(processPublicationInBackground(publicationId, pdfUrl));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'PDF processing started',
        publicationId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 202
      }
    );

  } catch (error) {
    console.error('[Request] Error:', error);

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
