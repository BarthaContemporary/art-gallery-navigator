import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ArtworkData {
  id: string;
  title: string;
  artist_name: string;
  year?: number;
  medium_type: string;
  materials?: string;
  dimensions?: string;
  price?: number;
  currency: string;
  status: string;
  classification: string;
  condition?: string;
  signature_type?: string;
  provenance?: string;
  exhibition_history?: string;
  story?: string;
  ai_description?: string;
  image_count: number;
}

interface RequestBody {
  artworks: ArtworkData[];
  title: string;
  accessToken: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    const body: RequestBody = await req.json();
    console.log(`Processing export request for ${body.artworks?.length || 0} artworks`);

    // Validate request
    if (!body.artworks || !Array.isArray(body.artworks) || body.artworks.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No artworks provided for export',
          errorType: 'validation_error'
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!body.accessToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Google access token is required',
          errorType: 'authentication_required'
        }), 
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create spreadsheet using Google Sheets API
    const spreadsheetTitle = body.title || `Artwork List - ${new Date().toLocaleDateString()}`;
    
    // First, create the spreadsheet
    const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${body.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: spreadsheetTitle,
        },
        sheets: [{
          properties: {
            title: 'Artworks',
            gridProperties: {
              rowCount: body.artworks.length + 2,
              columnCount: 20,
            },
          },
        }],
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Failed to create spreadsheet:', errorText);
      
      if (createResponse.status === 401) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Google authentication expired. Please try again.',
            errorType: 'authentication_expired'
          }), 
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to create spreadsheet in Google Drive',
          errorType: 'spreadsheet_creation_error',
          details: errorText
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const spreadsheetData = await createResponse.json();
    const spreadsheetId = spreadsheetData.spreadsheetId;
    console.log(`Created spreadsheet with ID: ${spreadsheetId}`);

    // Prepare data for the spreadsheet
    const headers = [
      'Title', 'Artist', 'Year', 'Medium Type', 'Materials', 'Dimensions',
      'Price', 'Currency', 'Status', 'Classification', 'Condition',
      'Signature Type', 'Provenance', 'Exhibition History', 'Story',
      'AI Description', 'Image Count'
    ];

    const rows = body.artworks.map(artwork => [
      artwork.title || '',
      artwork.artist_name || '',
      artwork.year || '',
      artwork.medium_type || '',
      artwork.materials || '',
      artwork.dimensions || '',
      artwork.price || '',
      artwork.currency || '',
      artwork.status || '',
      artwork.classification || '',
      artwork.condition || '',
      artwork.signature_type || '',
      artwork.provenance || '',
      artwork.exhibition_history || '',
      artwork.story || '',
      artwork.ai_description || '',
      artwork.image_count || 0
    ]);

    // Add data to the spreadsheet
    const updateResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Artworks!A1:Q${rows.length + 1}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${body.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [headers, ...rows],
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('Failed to update spreadsheet data:', errorText);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to add data to spreadsheet',
          errorType: 'spreadsheet_creation_error',
          details: errorText
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Format the spreadsheet (make headers bold, add filters)
    const formatResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${body.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: 0,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: headers.length,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: {
                      bold: true,
                    },
                    backgroundColor: {
                      red: 0.9,
                      green: 0.9,
                      blue: 0.9,
                    },
                  },
                },
                fields: 'userEnteredFormat(textFormat,backgroundColor)',
              },
            },
            {
              setBasicFilter: {
                filter: {
                  range: {
                    sheetId: 0,
                    startRowIndex: 0,
                    endRowIndex: rows.length + 1,
                    startColumnIndex: 0,
                    endColumnIndex: headers.length,
                  },
                },
              },
            },
          ],
        }),
      }
    );

    if (!formatResponse.ok) {
      console.warn('Failed to format spreadsheet, but continuing with basic version');
    }

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    
    console.log(`Successfully created and populated spreadsheet: ${spreadsheetUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        spreadsheetUrl,
        spreadsheetId,
        artworkCount: body.artworks.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Export process failed:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error during export',
        errorType: 'server_error',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
})