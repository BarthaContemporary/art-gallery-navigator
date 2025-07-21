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
    const { artworks } = await req.json();

    console.log('AI Content Enhancer - Processing', artworks.length, 'artworks');

    const prompt = `You are an art expert specializing in artwork descriptions and metadata enhancement. Analyze the provided artwork data and suggest content improvements.

Artwork Data (first 3 records): ${JSON.stringify(artworks.slice(0, 3))}

For each artwork, provide enhancement suggestions:

1. Generate compelling artwork descriptions (if missing or poor)
2. Suggest appropriate classifications based on medium/style
3. Recommend medium types if unclear
4. Suggest appropriate keywords for searchability
5. Flag any missing critical information

Return a JSON object with this structure:
{
  "enhancedArtworks": [
    {
      "originalRowIndex": 0,
      "enhancements": {
        "ai_description": "Professional artwork description if missing/needed",
        "suggested_classification": "original/print/edition/etc if needed",
        "suggested_medium_type": "painting/sculpture/photography/etc if needed",
        "additional_keywords": "comma-separated keywords for search",
        "story": "Brief story about the artwork if context available"
      },
      "confidenceScore": 0.8,
      "missingCriticalInfo": ["list of missing important fields"]
    }
  ],
  "contentInsights": [
    "Overall observations about the collection's content quality"
  ]
}

Guidelines:
- Only suggest descriptions for artworks that lack them or have very poor ones
- Descriptions should be 2-3 sentences, professional and informative
- Base suggestions on available data (title, artist, medium, year, materials)
- Don't make up specific details not evident from the data
- Focus on style, technique, and general characteristics
- Keywords should enhance discoverability`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert art curator and content writer. Always return valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log('AI Content Enhancement Response generated');

    let enhancementResult;
    try {
      enhancementResult = JSON.parse(aiResponse);
    } catch (e) {
      console.error('Failed to parse AI response:', aiResponse);
      throw new Error('Invalid AI response format');
    }

    return new Response(JSON.stringify(enhancementResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-content-enhancer:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});