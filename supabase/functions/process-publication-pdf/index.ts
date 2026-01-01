/**
 * Publication PDF Processing Edge Function
 * 
 * Uses CloudConvert API for PDF processing:
 * - PDF to images conversion with accurate page dimensions
 * 
 * NOTE: Maximum PDF file size is 100MB with CloudConvert
 */

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

// ============= CLOUDCONVERT API FUNCTIONS =============

interface CloudConvertJob {
  id: string;
  status: string;
  tasks: CloudConvertTask[];
}

interface CloudConvertTask {
  id: string;
  name: string;
  operation: string;
  status: string;
  result?: {
    files?: Array<{
      filename: string;
      url: string;
    }>;
  };
}

// Create CloudConvert job to convert PDF to JPEG images
async function createCloudConvertJob(
  pdfUrl: string,
  apiKey: string
): Promise<CloudConvertJob> {
  console.log('[CloudConvert] Creating PDF to images job...');
  
  const response = await fetch('https://api.cloudconvert.com/v2/jobs', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tasks: {
        'import-pdf': {
          operation: 'import/url',
          url: pdfUrl,
        },
        'convert-to-jpg': {
          operation: 'convert',
          input: 'import-pdf',
          input_format: 'pdf',
          output_format: 'jpg',
          all_pages: true,
          pixel_density: 150,  // DPI - good balance between quality and size
          quality: 90,
        },
        'export-result': {
          operation: 'export/url',
          input: 'convert-to-jpg',
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[CloudConvert] Job creation error:', errorText);
    throw new Error(`CloudConvert job creation failed: ${response.status} - ${errorText}`);
  }

  const job = await response.json();
  console.log('[CloudConvert] Job created:', job.data.id);
  return job.data;
}

// Wait for CloudConvert job to complete and return image URLs
async function waitForCloudConvertJob(
  jobId: string,
  apiKey: string
): Promise<string[]> {
  console.log('[CloudConvert] Waiting for job completion...');
  
  const maxAttempts = 120; // 10 minutes max
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    const response = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.warn(`[CloudConvert] Status check failed: ${response.status}`);
      attempts++;
      continue;
    }

    const jobData = await response.json();
    const job: CloudConvertJob = jobData.data;
    
    console.log(`[CloudConvert] Job status: ${job.status}`);

    if (job.status === 'finished') {
      // Find the export task and get the URLs
      const exportTask = job.tasks.find(t => t.operation === 'export/url');
      
      if (!exportTask?.result?.files) {
        throw new Error('No files in export task result');
      }

      const imageUrls = exportTask.result.files
        .filter(f => f.filename.endsWith('.jpg'))
        .sort((a, b) => {
          // Sort by page number (extract from filename like page-1.jpg)
          const aMatch = a.filename.match(/(\d+)/);
          const bMatch = b.filename.match(/(\d+)/);
          const aNum = aMatch ? parseInt(aMatch[1]) : 0;
          const bNum = bMatch ? parseInt(bMatch[1]) : 0;
          return aNum - bNum;
        })
        .map(f => f.url);

      console.log(`[CloudConvert] Job completed, ${imageUrls.length} page images`);
      return imageUrls;
    }

    if (job.status === 'error') {
      const errorTask = job.tasks.find(t => t.status === 'error');
      const errorMsg = errorTask ? JSON.stringify(errorTask) : 'Unknown error';
      throw new Error(`CloudConvert job failed: ${errorMsg}`);
    }

    attempts++;
  }

  throw new Error('CloudConvert job timed out');
}

// Upload image to Cloudinary for permanent storage
async function uploadImageToCloudinary(
  imageUrl: string,
  publicId: string,
  cloudName: string,
  apiKey: string,
  apiSecret: string
): Promise<{ url: string; width: number; height: number }> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Create signature
  const signatureString = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  const formData = new FormData();
  formData.append('file', imageUrl);
  formData.append('public_id', publicId);
  formData.append('timestamp', timestamp);
  formData.append('api_key', apiKey);
  formData.append('signature', signature);
  
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary upload failed: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  return {
    url: result.secure_url,
    width: result.width,
    height: result.height,
  };
}

// Get Cloudinary URL with transformations
function getCloudinaryTransformedUrl(
  cloudName: string,
  publicId: string,
  options: { width?: number; quality?: number } = {}
): string {
  const { width, quality = 80 } = options;
  let transformations = `q_${quality}`;
  if (width) {
    transformations += `,w_${width}`;
  }
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformations}/${publicId}`;
}

// ============= OPENAI FUNCTIONS =============

// OCR a page image using OpenAI GPT-4 Vision (fallback if needed)
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

// ============= MAIN PROCESSING =============

async function processPublicationInBackground(publicationId: string, pdfUrl: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  const cloudConvertApiKey = Deno.env.get('CLOUDCONVERT_API_KEY');
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const cloudinaryApiKey = Deno.env.get('CLOUDINARY_API_KEY');
  const cloudinaryApiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`[Process] Starting for publication ${publicationId}`);
    console.log(`[Process] PDF URL: ${pdfUrl}`);
    console.log(`[Process] CloudConvert: ${cloudConvertApiKey ? 'Configured' : 'Missing'}`);
    console.log(`[Process] OpenAI: ${openAIApiKey ? 'Present' : 'Missing'}`);
    console.log(`[Process] Cloudinary: ${cloudName && cloudinaryApiKey && cloudinaryApiSecret ? 'Configured' : 'Missing'}`);
    const startTime = Date.now();

    // Validate required secrets
    if (!cloudConvertApiKey) {
      throw new Error('CLOUDCONVERT_API_KEY is not configured');
    }
    
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    
    if (!cloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
      throw new Error('Cloudinary credentials are not fully configured');
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
    await supabase
      .from('publication_pages')
      .delete()
      .eq('publication_id', publicationId);

    // Step 2: Create CloudConvert job to convert PDF to images
    const job = await createCloudConvertJob(pdfUrl, cloudConvertApiKey);

    // Step 3: Wait for job completion and get image URLs
    const downloadUris = await waitForCloudConvertJob(job.id, cloudConvertApiKey);
    const pageCount = downloadUris.length;

    if (pageCount === 0) {
      throw new Error('No pages extracted from PDF');
    }

    // Save page count
    await supabase
      .from('publications')
      .update({ 
        page_count: pageCount,
      })
      .eq('id', publicationId);

    console.log(`[Process] Processing ${pageCount} pages... (${Date.now() - startTime}ms)`);

    // Step 4: Upload each page image to Cloudinary and OCR
    const pageTextsForAI: { pageNumber: number; text: string }[] = [];
    const pageRecords: any[] = [];
    
    const BATCH_SIZE = 3;
    const BATCH_DELAY_MS = 1000;
    
    for (let batchStart = 0; batchStart < downloadUris.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, downloadUris.length);
      console.log(`[Process] Batch: pages ${batchStart + 1}-${batchEnd} of ${pageCount}`);
      
      const batchPromises = [];
      
      for (let i = batchStart; i < batchEnd; i++) {
        const pageNumber = i + 1;
        const imageUrl = downloadUris[i];
        
        batchPromises.push((async () => {
          // Upload to Cloudinary for permanent storage
          const cloudinaryPublicId = `publications/${publicationId}/page_${pageNumber}`;
          
          const cloudinaryResult = await uploadImageToCloudinary(
            imageUrl,
            cloudinaryPublicId,
            cloudName,
            cloudinaryApiKey,
            cloudinaryApiSecret
          );
          
          const thumbnailUrl = getCloudinaryTransformedUrl(cloudName, cloudinaryPublicId, { width: 300, quality: 70 });
          const fullUrl = cloudinaryResult.url;
          
          // OCR the page using OpenAI Vision
          const textContent = await ocrPageWithOpenAI(fullUrl, pageNumber, openAIApiKey);
          
          return {
            publication_id: publicationId,
            page_number: pageNumber,
            text_content: textContent,
            render_low_url: thumbnailUrl,
            render_high_url: fullUrl,
            width: cloudinaryResult.width,
            height: cloudinaryResult.height,
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
      console.log(`[Process] Progress: ${progress}% (${batchEnd}/${pageCount})`);
      
      // Delay between batches
      if (batchEnd < pageCount) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    console.log(`[Process] All pages processed (${Date.now() - startTime}ms)`);

    // Step 6: Insert page records in batches
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

    // Step 7: Generate AI content (TOC, Index, Summary)
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

    // Step 8: Mark as completed
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
        message: 'PDF processing started (using CloudConvert)',
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
