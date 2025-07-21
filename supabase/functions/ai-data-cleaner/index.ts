import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artworks, fieldMappings } = await req.json();

    console.log('AI Data Cleaner - Processing', artworks.length, 'artworks');

    const prompt = `You are an expert at cleaning and standardizing artwork data. Review the following artwork data and suggest improvements.

Field Mappings: ${JSON.stringify(fieldMappings)}
Artwork Data (first 5 records): ${JSON.stringify(artworks.slice(0, 5))}

Please analyze and suggest cleaning/improvements for:
1. Standardize formats (dates, currencies, dimensions, etc.)
2. Fix common data issues (extra spaces, inconsistent capitalization)
3. Validate required fields and suggest defaults
4. Identify and flag suspicious or inconsistent data
5. Standardize artist names, medium types, and classifications

Return a JSON object with this structure:
{
  "cleanedArtworks": [
    {
      "originalRowIndex": 0,
      "suggestedChanges": {
        "field_name": {
          "original": "original value",
          "suggested": "cleaned value",
          "reason": "why this change was suggested"
        }
      },
      "qualityScore": 0.85,
      "warnings": ["any data quality warnings"]
    }
  ],
  "globalSuggestions": [
    "Overall data quality observations and suggestions"
  ]
}

Focus on:
- Currency standardization (USD, EUR, GBP format)
- Date standardization (YYYY format for years)
- Dimension standardization (consistent units)
- Artist name consistency
- Medium type standardization
- Title capitalization
- Remove extra spaces and normalize text`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert data cleaning assistant. Always return valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log('AI Data Cleaning Response generated');

    let cleaningResult;
    try {
      // Strip markdown code blocks if present
      let cleanedResponse = aiResponse.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      cleaningResult = JSON.parse(cleanedResponse);
    } catch (e) {
      console.error('Failed to parse AI response:', aiResponse);
      throw new Error('Invalid AI response format');
    }

    return new Response(JSON.stringify(cleaningResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-data-cleaner:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});