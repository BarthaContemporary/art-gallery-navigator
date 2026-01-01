import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversionRequest {
  fileName: string;
  fileBase64: string;
  outputFormat?: 'jpeg' | 'png' | 'webp';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CLOUDCONVERT_API_KEY = Deno.env.get('CLOUDCONVERT_API_KEY');
    if (!CLOUDCONVERT_API_KEY) {
      console.error('[convert-image-format] Missing CLOUDCONVERT_API_KEY');
      return new Response(
        JSON.stringify({ error: 'Service configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { fileName, fileBase64, outputFormat = 'jpeg' }: ConversionRequest = await req.json();

    if (!fileName || !fileBase64) {
      return new Response(
        JSON.stringify({ error: 'fileName and fileBase64 are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[convert-image-format] Converting ${fileName} to ${outputFormat}`);

    // Determine input format from file extension
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const inputFormat = extension === 'heif' ? 'heif' : extension === 'heic' ? 'heic' : extension;

    // Step 1: Create a job with CloudConvert
    const jobResponse = await fetch('https://api.cloudconvert.com/v2/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDCONVERT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tasks: {
          'import-file': {
            operation: 'import/base64',
            file: fileBase64,
            filename: fileName,
          },
          'convert-image': {
            operation: 'convert',
            input: ['import-file'],
            input_format: inputFormat,
            output_format: outputFormat,
            quality: 90,
          },
          'export-result': {
            operation: 'export/url',
            input: ['convert-image'],
            inline: false,
            archive_multiple_files: false,
          },
        },
        tag: 'artwork-image-conversion',
      }),
    });

    if (!jobResponse.ok) {
      const errorText = await jobResponse.text();
      console.error(`[convert-image-format] CloudConvert job creation failed: ${errorText}`);
      return new Response(
        JSON.stringify({ error: 'Image conversion service unavailable' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jobData = await jobResponse.json();
    const jobId = jobData.data.id;
    console.log(`[convert-image-format] Job created: ${jobId}`);

    // Step 2: Wait for job completion (poll with timeout)
    const maxAttempts = 30;
    const pollInterval = 2000;
    let attempts = 0;
    let jobStatus = 'processing';
    let exportTask = null;

    while (attempts < maxAttempts && jobStatus !== 'finished' && jobStatus !== 'error') {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const statusResponse = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${CLOUDCONVERT_API_KEY}`,
        },
      });

      if (!statusResponse.ok) {
        console.error(`[convert-image-format] Failed to check job status`);
        break;
      }

      const statusData = await statusResponse.json();
      jobStatus = statusData.data.status;
      
      if (jobStatus === 'finished') {
        exportTask = statusData.data.tasks.find((t: any) => t.name === 'export-result');
      }
      
      attempts++;
      console.log(`[convert-image-format] Job status: ${jobStatus} (attempt ${attempts})`);
    }

    if (jobStatus !== 'finished' || !exportTask?.result?.files?.[0]?.url) {
      console.error(`[convert-image-format] Job did not complete successfully. Status: ${jobStatus}`);
      return new Response(
        JSON.stringify({ error: 'Image conversion timed out or failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Download the converted file
    const convertedFileUrl = exportTask.result.files[0].url;
    const convertedFileName = exportTask.result.files[0].filename;
    
    console.log(`[convert-image-format] Downloading converted file: ${convertedFileName}`);
    
    const fileResponse = await fetch(convertedFileUrl);
    if (!fileResponse.ok) {
      console.error(`[convert-image-format] Failed to download converted file`);
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve converted image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    const base64Result = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

    console.log(`[convert-image-format] Conversion successful. Output size: ${fileBuffer.byteLength} bytes`);

    return new Response(
      JSON.stringify({
        success: true,
        convertedFileName,
        convertedFileBase64: base64Result,
        mimeType: `image/${outputFormat}`,
        size: fileBuffer.byteLength,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[convert-image-format] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
