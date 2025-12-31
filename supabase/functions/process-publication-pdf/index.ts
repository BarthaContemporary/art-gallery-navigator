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

// Upload PDF to Cloudinary using chunked upload for large files
async function uploadPdfToCloudinary(
  pdfUrl: string,
  publicationId: string,
  cloudName: string,
  apiKey: string,
  apiSecret: string
): Promise<{ publicId: string; pageCount: number; width: number; height: number } | null> {
  try {
    console.log('[Cloudinary] Downloading PDF from source...');
    
    // First, download the PDF as binary data
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      console.error('[Cloudinary] Failed to download PDF:', pdfResponse.status);
      return null;
    }
    
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfSize = pdfBuffer.byteLength;
    console.log(`[Cloudinary] PDF downloaded: ${(pdfSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Generate signature for signed upload
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `publications/${publicationId}`;
    
    // For large files (>10MB), we need to use chunked upload
    const CHUNK_SIZE = 6 * 1024 * 1024; // 6MB chunks (under 10MB limit)
    const isLargeFile = pdfSize > 10 * 1024 * 1024;
    
    if (isLargeFile) {
      console.log('[Cloudinary] Using chunked upload for large file...');
      return await uploadChunked(pdfBuffer, publicId, cloudName, apiKey, apiSecret, timestamp);
    }
    
    // For smaller files, use direct upload
    console.log('[Cloudinary] Using direct upload...');
    const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}`;
    
    // Create signature
    const encoder = new TextEncoder();
    const data = encoder.encode(paramsToSign + apiSecret);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Create blob from buffer
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
    
    // Upload using signed upload with actual file data
    const formData = new FormData();
    formData.append('file', pdfBlob, `${publicationId}.pdf`);
    formData.append('public_id', publicId);
    formData.append('timestamp', timestamp.toString());
    formData.append('api_key', apiKey);
    formData.append('signature', signature);
    
    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[Cloudinary] Upload failed:', uploadResponse.status, errorText);
      return null;
    }
    
    const result = await uploadResponse.json();
    console.log('[Cloudinary] Upload successful:', {
      publicId: result.public_id,
      pages: result.pages,
      width: result.width,
      height: result.height,
    });
    
    return {
      publicId: result.public_id,
      pageCount: result.pages || 1,
      width: result.width || 612,
      height: result.height || 792,
    };
  } catch (error) {
    console.error('[Cloudinary] Error uploading PDF:', error);
    return null;
  }
}

// Chunked upload for large PDFs
async function uploadChunked(
  pdfBuffer: ArrayBuffer,
  publicId: string,
  cloudName: string,
  apiKey: string,
  apiSecret: string,
  timestamp: number
): Promise<{ publicId: string; pageCount: number; width: number; height: number } | null> {
  try {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const totalSize = pdfBuffer.byteLength;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    const uniqueUploadId = `${publicId}_${Date.now()}`;
    
    console.log(`[Cloudinary] Chunked upload: ${totalChunks} chunks of ${(CHUNK_SIZE / 1024 / 1024).toFixed(1)}MB`);
    
    let lastResult: any = null;
    
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalSize);
      const chunk = pdfBuffer.slice(start, end);
      const isLastChunk = chunkIndex === totalChunks - 1;
      
      console.log(`[Cloudinary] Uploading chunk ${chunkIndex + 1}/${totalChunks} (${start}-${end}/${totalSize})`);
      
      // For chunked uploads, we use different parameters
      const paramsToSign = isLastChunk 
        ? `public_id=${publicId}&timestamp=${timestamp}`
        : `timestamp=${timestamp}`;
      
      const encoder = new TextEncoder();
      const data = encoder.encode(paramsToSign + apiSecret);
      const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      const chunkBlob = new Blob([chunk], { type: 'application/pdf' });
      
      const formData = new FormData();
      formData.append('file', chunkBlob, `${publicId}.pdf`);
      formData.append('timestamp', timestamp.toString());
      formData.append('api_key', apiKey);
      formData.append('signature', signature);
      formData.append('upload_preset', ''); // Empty for signed upload
      
      // Required headers for chunked upload
      const headers: Record<string, string> = {
        'X-Unique-Upload-Id': uniqueUploadId,
        'Content-Range': `bytes ${start}-${end - 1}/${totalSize}`,
      };
      
      if (isLastChunk) {
        formData.append('public_id', publicId);
      }
      
      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: 'POST',
          headers,
          body: formData,
        }
      );
      
      const responseText = await uploadResponse.text();
      
      if (!uploadResponse.ok && !responseText.includes('"done":true')) {
        console.error(`[Cloudinary] Chunk ${chunkIndex + 1} failed:`, uploadResponse.status, responseText);
        
        // For non-final chunks, 200 with partial response is expected
        if (!isLastChunk && uploadResponse.status === 200) {
          continue;
        }
        return null;
      }
      
      if (isLastChunk || responseText.includes('"public_id"')) {
        try {
          lastResult = JSON.parse(responseText);
        } catch (e) {
          // Not JSON yet, continue
        }
      }
    }
    
    if (lastResult && lastResult.public_id) {
      console.log('[Cloudinary] Chunked upload successful:', {
        publicId: lastResult.public_id,
        pages: lastResult.pages,
        width: lastResult.width,
        height: lastResult.height,
      });
      
      return {
        publicId: lastResult.public_id,
        pageCount: lastResult.pages || 1,
        width: lastResult.width || 612,
        height: lastResult.height || 792,
      };
    }
    
    // If chunked upload didn't return page info, try to probe
    console.log('[Cloudinary] Chunked upload completed, probing for page count...');
    return null;
  } catch (error) {
    console.error('[Cloudinary] Chunked upload error:', error);
    return null;
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
    
    if (!cloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
      throw new Error('Cloudinary credentials are not configured');
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

    // Step 2: Upload PDF to Cloudinary
    console.log('[Process] Uploading PDF to Cloudinary...');
    const uploadResult = await uploadPdfToCloudinary(
      pdfUrl,
      publicationId,
      cloudName,
      cloudinaryApiKey,
      cloudinaryApiSecret
    );
    
    let cloudinaryPublicId: string;
    let pageCount: number;
    let defaultWidth = 612;
    let defaultHeight = 792;
    
    if (uploadResult) {
      cloudinaryPublicId = uploadResult.publicId;
      pageCount = uploadResult.pageCount;
      defaultWidth = uploadResult.width;
      defaultHeight = uploadResult.height;
      console.log(`[Process] Cloudinary upload successful: ${pageCount} pages, ${defaultWidth}x${defaultHeight}`);
    } else {
      // Fallback: try to use existing Cloudinary public ID or probe for pages
      const existingPublicId = `publications/${publicationId}`;
      console.log('[Process] Trying to probe existing Cloudinary resource...');
      
      const probeUrl = getCloudinaryPageUrl(cloudName, existingPublicId, 1);
      const probeResponse = await fetch(probeUrl, { method: 'HEAD' });
      
      if (probeResponse.ok) {
        cloudinaryPublicId = existingPublicId;
        pageCount = await getPdfPageCount(cloudName, cloudinaryPublicId);
        console.log(`[Process] Found existing Cloudinary resource with ${pageCount} pages`);
      } else {
        throw new Error('Failed to upload PDF to Cloudinary and no existing resource found');
      }
    }

    // Save Cloudinary public ID
    await supabase
      .from('publications')
      .update({ 
        cloudinary_public_id: cloudinaryPublicId,
        page_count: pageCount
      })
      .eq('id', publicationId);

    console.log(`[Process] Processing ${pageCount} pages... (${Date.now() - startTime}ms)`);

    // Step 3: Process each page - OCR with OpenAI Vision
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
          // Get Cloudinary URLs for this page
          const thumbnailUrl = getCloudinaryPageUrl(cloudName, cloudinaryPublicId, pageNumber, { width: 300, quality: 70 });
          const fullUrl = getCloudinaryPageUrl(cloudName, cloudinaryPublicId, pageNumber, { quality: 90 });
          
          // Get page dimensions
          const dimensions = await getPageDimensions(cloudName, cloudinaryPublicId, pageNumber);
          const width = dimensions?.width || defaultWidth;
          const height = dimensions?.height || defaultHeight;
          
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
