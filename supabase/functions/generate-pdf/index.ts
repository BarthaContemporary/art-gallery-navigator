import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PDFRequest {
  html: string;
  fileName: string;
  pageSize?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cloudConvertApiKey = Deno.env.get('CLOUDCONVERT_API_KEY');
    const pdfLayerApiKey = Deno.env.get('PDFLAYER_API_KEY');

    const { 
      html, 
      fileName,
      pageSize = 'a4',
      orientation = 'portrait',
      marginTop = 10,
      marginBottom = 10,
      marginLeft = 10,
      marginRight = 10
    }: PDFRequest = await req.json();

    if (!html) {
      throw new Error('HTML content is required');
    }

    console.log(`Generating PDF: ${fileName}, size: ${pageSize}, orientation: ${orientation}`);

    // Try CloudConvert first (higher quality), fallback to PDFLayer
    if (cloudConvertApiKey) {
      try {
        const result = await generateWithCloudConvert(
          cloudConvertApiKey,
          html,
          pageSize,
          orientation,
          marginTop,
          marginBottom,
          marginLeft,
          marginRight
        );
        console.log(`PDF generated with CloudConvert, size: ${result.size} bytes`);
        return new Response(
          JSON.stringify({ success: true, pdf: result.pdf, size: result.size }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.warn('CloudConvert failed, trying PDFLayer fallback:', error.message);
      }
    }

    // Fallback to PDFLayer
    if (pdfLayerApiKey) {
      const result = await generateWithPDFLayer(
        pdfLayerApiKey,
        html,
        pageSize,
        orientation,
        marginTop,
        marginBottom,
        marginLeft,
        marginRight
      );
      console.log(`PDF generated with PDFLayer, size: ${result.size} bytes`);
      return new Response(
        JSON.stringify({ success: true, pdf: result.pdf, size: result.size }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('No PDF generation API key configured (CLOUDCONVERT_API_KEY or PDFLAYER_API_KEY)');

  } catch (error) {
    console.error('Error generating PDF:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateWithCloudConvert(
  apiKey: string,
  html: string,
  pageSize: string,
  orientation: string,
  marginTop: number,
  marginBottom: number,
  marginLeft: number,
  marginRight: number
): Promise<{ pdf: string; size: number }> {
  // Map page sizes
  const pageSizeMap: Record<string, { width: number; height: number }> = {
    'a4': { width: 210, height: 297 },
    'letter': { width: 216, height: 279 },
    'legal': { width: 216, height: 356 },
  };

  const dimensions = pageSizeMap[pageSize] || pageSizeMap['a4'];

  // Create job with HTML to PDF conversion
  const jobResponse = await fetch('https://api.cloudconvert.com/v2/jobs', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tasks: {
        'import-html': {
          operation: 'import/raw',
          file: html,
          filename: 'document.html',
        },
        'convert-to-pdf': {
          operation: 'convert',
          input: ['import-html'],
          output_format: 'pdf',
          engine: 'chrome',
          page_width: dimensions.width,
          page_height: dimensions.height,
          page_orientation: orientation,
          margin_top: marginTop,
          margin_bottom: marginBottom,
          margin_left: marginLeft,
          margin_right: marginRight,
          print_background: true,
        },
        'export-result': {
          operation: 'export/url',
          input: ['convert-to-pdf'],
          inline: true,
        },
      },
      tag: 'html-to-pdf',
    }),
  });

  if (!jobResponse.ok) {
    const errorText = await jobResponse.text();
    throw new Error(`CloudConvert job creation failed: ${errorText}`);
  }

  const job = await jobResponse.json();
  const jobId = job.data.id;
  console.log(`CloudConvert job created: ${jobId}`);

  // Poll for completion
  let attempts = 0;
  const maxAttempts = 60; // 60 seconds max
  let completedJob = null;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const statusResponse = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!statusResponse.ok) {
      throw new Error('Failed to check job status');
    }

    const statusData = await statusResponse.json();
    
    if (statusData.data.status === 'finished') {
      completedJob = statusData.data;
      break;
    } else if (statusData.data.status === 'error') {
      const errorTask = statusData.data.tasks?.find((t: any) => t.status === 'error');
      throw new Error(`Conversion failed: ${errorTask?.message || 'Unknown error'}`);
    }

    attempts++;
  }

  if (!completedJob) {
    throw new Error('Job timed out');
  }

  // Get the PDF URL
  const exportTask = completedJob.tasks?.find((t: any) => t.name === 'export-result' && t.status === 'finished');
  if (!exportTask?.result?.files?.[0]?.url) {
    throw new Error('No PDF URL in result');
  }

  // Download the PDF
  const pdfResponse = await fetch(exportTask.result.files[0].url);
  if (!pdfResponse.ok) {
    throw new Error('Failed to download PDF');
  }

  const pdfBuffer = await pdfResponse.arrayBuffer();
  const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

  return { pdf: base64Pdf, size: pdfBuffer.byteLength };
}

async function generateWithPDFLayer(
  apiKey: string,
  html: string,
  pageSize: string,
  orientation: string,
  marginTop: number,
  marginBottom: number,
  marginLeft: number,
  marginRight: number
): Promise<{ pdf: string; size: number }> {
  const pageSizeMap: Record<string, string> = {
    'a4': 'A4',
    'letter': 'Letter',
    'legal': 'Legal'
  };

  const params = new URLSearchParams({
    access_key: apiKey,
    document_html: html,
    page_size: pageSizeMap[pageSize] || 'A4',
    orientation: orientation,
    margin_top: marginTop.toString(),
    margin_bottom: marginBottom.toString(),
    margin_left: marginLeft.toString(),
    margin_right: marginRight.toString(),
    text_encoding: 'utf-8',
    ttl: '300',
  });

  const response = await fetch('https://api.pdflayer.com/api/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PDFLayer API error: ${response.status} - ${errorText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const errorData = await response.json();
    throw new Error(errorData.error?.info || 'PDFLayer conversion failed');
  }

  const pdfBuffer = await response.arrayBuffer();
  const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

  return { pdf: base64Pdf, size: pdfBuffer.byteLength };
}
