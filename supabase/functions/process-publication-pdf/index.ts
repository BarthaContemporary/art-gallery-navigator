import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocumentProxy, extractText, renderPageAsImage } from "https://esm.sh/unpdf@0.12.1";

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

// Render a PDF page to a JPEG image using unpdf
async function renderPageToImage(
  pdfData: Uint8Array,
  pageNumber: number,
  scale: number = 1.5
): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  try {
    const result = await renderPageAsImage(pdfData, pageNumber, {
      scale,
      format: 'jpeg',
      quality: 85,
    });
    
    return {
      data: result.data,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.error(`[Render] Error rendering page ${pageNumber}:`, error);
    return null;
  }
}

// Upload rendered page image to Supabase Storage
async function uploadPageImage(
  supabase: any,
  publicationId: string,
  pageNumber: number,
  imageData: Uint8Array,
  size: 'thumb' | 'full'
): Promise<string | null> {
  try {
    const fileName = `${publicationId}/page_${pageNumber.toString().padStart(4, '0')}_${size}.jpg`;
    
    const { data, error } = await supabase.storage
      .from('publication-pages')
      .upload(fileName, imageData, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    
    if (error) {
      console.error(`[Storage] Error uploading ${size} image for page ${pageNumber}:`, error);
      return null;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('publication-pages')
      .getPublicUrl(fileName);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error(`[Storage] Error uploading page ${pageNumber}:`, error);
    return null;
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

    // STEP 2: Fetch the PDF
    console.log('[Background] Fetching PDF from URL:', pdfUrl);
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfData = new Uint8Array(pdfBuffer);
    console.log(`[Background] PDF fetched, size: ${pdfBuffer.byteLength} bytes (${Date.now() - startTime}ms)`);

    // STEP 3: Load PDF using unpdf
    console.log('[Background] Loading PDF document...');
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

    // STEP 5: Render pages and upload to storage
    console.log('[Background] Rendering and uploading page images...');
    const pageRecords = [];
    const MIN_TEXT_THRESHOLD = 50;
    const pageTextsForAI: { pageNumber: number; text: string }[] = [];
    
    // Process pages in batches to avoid memory issues
    const RENDER_BATCH_SIZE = 5;
    
    for (let batchStart = 0; batchStart < pageCount; batchStart += RENDER_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + RENDER_BATCH_SIZE, pageCount);
      console.log(`[Background] Processing pages ${batchStart + 1}-${batchEnd} of ${pageCount}`);
      
      const batchPromises = [];
      
      for (let i = batchStart; i < batchEnd; i++) {
        const pageNumber = i + 1;
        const pageText = (allPageTexts[i] || '').trim();
        
        batchPromises.push((async () => {
          let thumbnailUrl: string | null = null;
          let fullUrl: string | null = null;
          let pageWidth: number | null = null;
          let pageHeight: number | null = null;
          
          // Render thumbnail (scale 0.5)
          const thumbResult = await renderPageToImage(pdfData, pageNumber, 0.5);
          if (thumbResult) {
            thumbnailUrl = await uploadPageImage(supabase, publicationId, pageNumber, thumbResult.data, 'thumb');
            pageWidth = thumbResult.width * 2; // Original size (before 0.5 scale)
            pageHeight = thumbResult.height * 2;
          }
          
          // Render full size (scale 1.5)
          const fullResult = await renderPageToImage(pdfData, pageNumber, 1.5);
          if (fullResult) {
            fullUrl = await uploadPageImage(supabase, publicationId, pageNumber, fullResult.data, 'full');
            if (!pageWidth) {
              pageWidth = Math.round(fullResult.width / 1.5);
              pageHeight = Math.round(fullResult.height / 1.5);
            }
          }
          
          return {
            publication_id: publicationId,
            page_number: pageNumber,
            text_content: pageText,
            render_low_url: thumbnailUrl,
            render_high_url: fullUrl,
            width: pageWidth,
            height: pageHeight,
          };
        })());
      }
      
      const batchResults = await Promise.all(batchPromises);
      pageRecords.push(...batchResults);
      
      // Update progress
      const progress = Math.round((batchEnd / pageCount) * 100);
      console.log(`[Background] Render progress: ${progress}% (${batchEnd}/${pageCount} pages)`);
    }
    
    // Collect page texts for AI processing
    for (const record of pageRecords) {
      pageTextsForAI.push({ pageNumber: record.page_number, text: record.text_content || '' });
    }

    console.log(`[Background] Page rendering complete (${Date.now() - startTime}ms)`);

    // STEP 6: Insert pages in batches
    const INSERT_BATCH_SIZE = 50;
    for (let i = 0; i < pageRecords.length; i += INSERT_BATCH_SIZE) {
      const batch = pageRecords.slice(i, i + INSERT_BATCH_SIZE);
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

    // STEP 7: OCR for pages with sparse text (if OpenAI key available)
    if (openAIApiKey) {
      const sparseTextPages = pageRecords.filter(p => (p.text_content?.length || 0) < MIN_TEXT_THRESHOLD && p.render_high_url);
      
      if (sparseTextPages.length > 0 && sparseTextPages.length <= 50) { // Limit OCR to 50 pages max
        console.log(`[Background] ${sparseTextPages.length} pages have sparse text, processing with OCR...`);
        
        const OCR_CONCURRENCY = 3;
        
        for (let i = 0; i < sparseTextPages.length; i += OCR_CONCURRENCY) {
          const batch = sparseTextPages.slice(i, i + OCR_CONCURRENCY);
          console.log(`[Background] OCR batch ${i + 1}-${i + batch.length} of ${sparseTextPages.length}`);
          
          await Promise.all(batch.map(async (page) => {
            try {
              const ocrText = await ocrPageWithOpenAI(page.render_high_url!, page.page_number, openAIApiKey);
              if (ocrText && ocrText.length > 10) {
                await supabase
                  .from('publication_pages')
                  .update({ text_content: ocrText })
                  .eq('publication_id', publicationId)
                  .eq('page_number', page.page_number);
                
                const idx = pageTextsForAI.findIndex(p => p.pageNumber === page.page_number);
                if (idx !== -1) {
                  pageTextsForAI[idx].text = ocrText;
                }
              }
            } catch (ocrError) {
              console.warn(`[OCR] Failed for page ${page.page_number}:`, ocrError);
            }
          }));
        }
        
        console.log(`[Background] OCR complete`);
      }

      // STEP 8: Generate TOC, Keyword Index, and Summary
      console.log('[Background] Generating AI content (TOC, Index, Summary)...');
      
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

    EdgeRuntime.waitUntil(processPublicationInBackground(publicationId, pdfUrl));

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
