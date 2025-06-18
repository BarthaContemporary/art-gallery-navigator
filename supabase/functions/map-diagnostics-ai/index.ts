
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
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { errorLogs, codeContext, issue } = await req.json();

    const systemPrompt = `You are an expert React/TypeScript developer specializing in Google Maps integration and component lifecycle management. You analyze complex timing issues, memory leaks, and DOM manipulation problems.

Focus on:
1. Component lifecycle timing issues
2. DOM element availability and cleanup
3. Google Maps API integration patterns
4. useEffect dependency management
5. Ref management and cleanup
6. Async operation coordination

Provide specific, actionable solutions with code examples.`;

    const userPrompt = `I'm having persistent issues with a Google Maps React component where the map container becomes unavailable after cleanup, causing initialization failures.

**Current Issue:**
${issue}

**Error Logs:**
${errorLogs}

**Code Context:**
${codeContext}

**Common Errors Seen:**
- "Map container not available after cleanup"
- "Map container became unavailable during initialization"
- "Container not ready yet, delaying initialization"

Please analyze this and provide:
1. Root cause analysis
2. Specific code fixes
3. Best practices for React + Google Maps integration
4. Proper cleanup patterns
5. Timing coordination strategies

Focus on the container lifecycle management and proper async coordination.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    console.log('Map diagnostics AI analysis completed');

    return new Response(JSON.stringify({ 
      analysis,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in map-diagnostics-ai function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
