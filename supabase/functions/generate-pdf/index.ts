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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('PDFLAYER_API_KEY');
    if (!apiKey) {
      throw new Error('PDFLAYER_API_KEY not configured');
    }

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

    // Map page sizes to PDFLayer format
    const pageSizeMap: Record<string, string> = {
      'a4': 'A4',
      'letter': 'Letter',
      'legal': 'Legal'
    };

    // Build PDFLayer API request
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
      ttl: '300', // Cache for 5 minutes
    });

    const response = await fetch('https://api.pdflayer.com/api/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PDFLayer API error:', errorText);
      throw new Error(`PDFLayer API error: ${response.status} - ${errorText}`);
    }

    // Check if response is JSON (error) or binary (PDF)
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const errorData = await response.json();
      console.error('PDFLayer returned error:', errorData);
      throw new Error(errorData.error?.info || 'PDFLayer conversion failed');
    }

    // Get PDF binary data
    const pdfBuffer = await response.arrayBuffer();
    console.log(`PDF generated successfully, size: ${pdfBuffer.byteLength} bytes`);

    // Return PDF as base64 encoded string
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdf: base64Pdf,
        size: pdfBuffer.byteLength 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error generating PDF:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
