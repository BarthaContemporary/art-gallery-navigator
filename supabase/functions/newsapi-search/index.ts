import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsAPIArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('NEWSAPI_API_KEY');
    if (!apiKey) {
      throw new Error('NEWSAPI_API_KEY not configured');
    }

    const { artistName, pageSize = 10 } = await req.json();

    if (!artistName) {
      throw new Error('Artist name is required');
    }

    console.log(`Searching NewsAPI for: ${artistName}`);

    // Search for articles about the artist
    // Using "everything" endpoint for broader coverage including art/culture news
    const searchQuery = encodeURIComponent(`"${artistName}" AND (artist OR art OR exhibition OR gallery OR museum)`);
    
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=${searchQuery}&sortBy=publishedAt&pageSize=${pageSize}&language=en`,
      {
        headers: {
          'X-Api-Key': apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NewsAPI error:', errorText);
      throw new Error(`NewsAPI error: ${response.status}`);
    }

    const data: NewsAPIResponse = await response.json();

    if (data.status !== 'ok') {
      throw new Error('NewsAPI returned error status');
    }

    console.log(`Found ${data.totalResults} articles for ${artistName}`);

    // Transform to our article format
    const articles = data.articles.map((article, index) => ({
      id: `newsapi-${index}-${Date.now()}`,
      title: article.title,
      description: article.description,
      thumbnail: article.urlToImage,
      url: article.url,
      sourceName: article.source.name,
      author: article.author,
      publishedDate: article.publishedAt,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        articles,
        total: data.totalResults,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error searching NewsAPI:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        articles: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
