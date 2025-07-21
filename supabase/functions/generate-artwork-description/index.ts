import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateDescriptionRequest {
  title: string;
  artist_name?: string;
  medium_type?: string;
  year?: number;
  materials?: string;
  dimensions?: string;
  story?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const { title, artist_name, medium_type, year, materials, dimensions, story }: GenerateDescriptionRequest = await req.json();

    // Build a comprehensive prompt from the artwork data
    let prompt = `Generate a professional, engaging description for this artwork:\n\n`;
    prompt += `Title: ${title}\n`;
    if (artist_name) prompt += `Artist: ${artist_name}\n`;
    if (medium_type) prompt += `Medium: ${medium_type}\n`;
    if (year) prompt += `Year: ${year}\n`;
    if (materials) prompt += `Materials: ${materials}\n`;
    if (dimensions) prompt += `Dimensions: ${dimensions}\n`;
    if (story) prompt += `Artist's Story: ${story}\n`;
    
    prompt += `\nWrite a compelling 2-3 sentence description that would engage potential collectors and art enthusiasts. Focus on the artistic technique, emotional impact, and what makes this piece unique. Keep it professional but accessible.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert art curator and writer who creates compelling artwork descriptions for galleries and collectors. Write engaging, professional descriptions that highlight the artistic value and emotional resonance of artworks.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    console.log('OpenAI API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error details:', errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a few minutes.');
      }
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const generatedDescription = data.choices[0].message.content;

    console.log('Generated description:', generatedDescription);

    return new Response(JSON.stringify({ description: generatedDescription }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-artwork-description function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});