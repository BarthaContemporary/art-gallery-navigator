import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { headers, sampleData } = await req.json();

    console.log('AI Field Mapper - Processing headers:', headers);

    // Available artwork fields for mapping
    const availableFields = [
      { value: "title", label: "Title", description: "The artwork's title or name" },
      { value: "artist_id", label: "Artist ID", description: "Direct artist database ID" },
      { value: "artist_name", label: "Artist Name", description: "Artist's full name for lookup/creation" },
      { value: "year", label: "Year", description: "Year the artwork was created" },
      { value: "medium_type", label: "Medium Type", description: "Type of medium (painting, sculpture, etc.)" },
      { value: "materials", label: "Materials", description: "Materials used in the artwork" },
      { value: "classification", label: "Classification", description: "Artwork classification (original, print, etc.)" },
      { value: "edition_size", label: "Edition Size", description: "Total number in edition" },
      { value: "dimensions", label: "Dimensions", description: "Combined dimensions string" },
      { value: "price", label: "Price", description: "Artwork price" },
      { value: "currency", label: "Currency", description: "Price currency (USD, EUR, etc.)" },
      { value: "status", label: "Status", description: "Availability status" },
      { value: "image_url", label: "Image URL", description: "Primary image URL" },
      { value: "height", label: "Height", description: "Height in centimeters" },
      { value: "width", label: "Width", description: "Width in centimeters" },
      { value: "depth", label: "Depth", description: "Depth in centimeters" },
      { value: "condition", label: "Condition", description: "Artwork condition" },
      { value: "provenance", label: "Provenance", description: "Artwork history and ownership" },
      { value: "signature_type", label: "Signature Type", description: "How the artwork is signed" },
      { value: "inventory_quantity", label: "Inventory Quantity", description: "Number available" },
    ];

    const prompt = `You are an expert at mapping CSV columns to database fields for artwork management. 

CSV Headers: ${JSON.stringify(headers)}
Sample Data: ${JSON.stringify(sampleData.slice(0, 3))}

Available Database Fields:
${availableFields.map(field => `- ${field.value}: ${field.label} - ${field.description}`).join('\n')}

Analyze the CSV headers and sample data, then suggest the best mapping for each CSV column to the available database fields.

Return a JSON object with this structure:
{
  "mappings": [
    {
      "csvHeader": "CSV column name",
      "suggestedField": "database_field_name or null if no good match",
      "confidence": 0.95,
      "reasoning": "Why this mapping makes sense"
    }
  ],
  "dataQualityNotes": [
    "Any observations about data quality or formatting issues"
  ]
}

Rules:
- Only suggest mappings to fields that actually exist in the available fields list
- Use null for csvHeader values that don't have good database field matches
- Confidence should be 0.0 to 1.0 (1.0 = completely certain)
- Focus on the most important fields first (title, artist_name, price, etc.)
- Consider variations in naming (e.g., "Artist" could map to "artist_name")`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert data mapping assistant. Always return valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log('AI Response:', aiResponse);

    // Parse the AI response
    let mappingResult;
    try {
      // Strip markdown code blocks if present
      let cleanedResponse = aiResponse.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      mappingResult = JSON.parse(cleanedResponse);
    } catch (e) {
      console.error('Failed to parse AI response:', aiResponse);
      throw new Error('Invalid AI response format');
    }

    return new Response(JSON.stringify(mappingResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-field-mapper:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});