import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExportRequest {
  html: string;
  fileName: string;
  format: 'docx' | 'xlsx' | 'pdf';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('CLOUDCONVERT_API_KEY');
    if (!apiKey) {
      throw new Error('CLOUDCONVERT_API_KEY not configured');
    }

    const { html, fileName, format }: ExportRequest = await req.json();

    if (!html) {
      throw new Error('HTML content is required');
    }

    console.log(`Exporting to ${format}: ${fileName}`);

    // Create CloudConvert job for HTML to DOCX/XLSX conversion
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
          'convert-document': {
            operation: 'convert',
            input: ['import-html'],
            output_format: format,
            engine: format === 'docx' ? 'office' : 'libreoffice',
          },
          'export-result': {
            operation: 'export/url',
            input: ['convert-document'],
            inline: false,
          },
        },
        tag: `html-to-${format}`,
      }),
    });

    if (!jobResponse.ok) {
      const errorText = await jobResponse.text();
      console.error('CloudConvert job creation error:', errorText);
      throw new Error(`CloudConvert API error: ${jobResponse.status}`);
    }

    const job = await jobResponse.json();
    const jobId = job.data.id;
    console.log(`Job created: ${jobId}`);

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60;
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
      console.log(`Job status: ${statusData.data.status}`);

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

    // Get the export URL
    const exportTask = completedJob.tasks?.find((t: any) => t.name === 'export-result' && t.status === 'finished');
    if (!exportTask?.result?.files?.[0]?.url) {
      throw new Error('No download URL in result');
    }

    const downloadUrl = exportTask.result.files[0].url;
    console.log(`Export complete: ${downloadUrl}`);

    // Download the file and return as base64
    const fileResponse = await fetch(downloadUrl);
    if (!fileResponse.ok) {
      throw new Error('Failed to download converted file');
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

    return new Response(
      JSON.stringify({ 
        success: true, 
        file: base64File,
        fileName: exportTask.result.files[0].filename,
        size: fileBuffer.byteLength,
        format,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error exporting document:', error);
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
