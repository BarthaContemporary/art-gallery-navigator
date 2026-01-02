import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PreviewRequest {
  documentUrl: string;
  fileName: string;
  mimeType?: string;
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

    const { documentUrl, fileName, mimeType }: PreviewRequest = await req.json();

    if (!documentUrl) {
      throw new Error('Document URL is required');
    }

    console.log(`Generating preview for: ${fileName}, type: ${mimeType}`);

    // Determine input format from mime type or filename
    const inputFormat = getInputFormat(mimeType, fileName);
    if (!inputFormat) {
      throw new Error(`Unsupported file format: ${mimeType || fileName}`);
    }

    console.log(`Detected input format: ${inputFormat}`);

    // Step 1: Create CloudConvert job
    const jobResponse = await fetch('https://api.cloudconvert.com/v2/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tasks: {
          'import-file': {
            operation: 'import/url',
            url: documentUrl,
          },
          'convert-to-png': {
            operation: 'convert',
            input: ['import-file'],
            output_format: 'png',
            some_pages: '1', // Only first page for preview
            width: 400, // Thumbnail width
            height: 566, // Approximate A4 ratio height
            fit: 'max',
          },
          'export-result': {
            operation: 'export/url',
            input: ['convert-to-png'],
            inline: true,
          },
        },
        tag: 'document-preview',
      }),
    });

    if (!jobResponse.ok) {
      const errorData = await jobResponse.text();
      console.error('CloudConvert job creation error:', errorData);
      throw new Error(`CloudConvert API error: ${jobResponse.status}`);
    }

    const job = await jobResponse.json();
    console.log(`Job created: ${job.data.id}`);

    // Step 2: Wait for job completion (poll with timeout)
    const jobId = job.data.id;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max wait
    let completedJob = null;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
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

    // Step 3: Get the export URL
    const exportTask = completedJob.tasks?.find((t: any) => t.name === 'export-result' && t.status === 'finished');
    if (!exportTask || !exportTask.result?.files?.[0]?.url) {
      throw new Error('No preview URL in result');
    }

    const previewUrl = exportTask.result.files[0].url;
    console.log(`Preview generated successfully: ${previewUrl}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        previewUrl,
        fileName: exportTask.result.files[0].filename,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error generating preview:', error);
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

function getInputFormat(mimeType?: string, fileName?: string): string | null {
  const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.ms-powerpoint': 'ppt',
    'text/plain': 'txt',
    'text/csv': 'csv',
  };

  if (mimeType && mimeMap[mimeType]) {
    return mimeMap[mimeType];
  }

  // Fallback to extension
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const validExts = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'csv'];
    if (ext && validExts.includes(ext)) {
      return ext;
    }
  }

  return null;
}
