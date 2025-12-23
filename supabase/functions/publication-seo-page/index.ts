import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slugOrId = url.searchParams.get('slug');
    const pageNumber = parseInt(url.searchParams.get('page') || '1', 10);
    const format = url.searchParams.get('format') || 'html'; // 'html' or 'json'

    if (!slugOrId) {
      return new Response('Publication slug/id required', { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch publication
    let publication;
    const { data: pubBySlug } = await supabase
      .from('publications')
      .select('*')
      .eq('slug', slugOrId)
      .single();

    if (pubBySlug) {
      publication = pubBySlug;
    } else {
      const { data: pubById } = await supabase
        .from('publications')
        .select('*')
        .eq('id', slugOrId)
        .single();
      publication = pubById;
    }

    if (!publication) {
      return new Response('Publication not found', { status: 404, headers: corsHeaders });
    }

    // Check visibility
    if (publication.visibility === 'private') {
      return new Response('Publication is private', { status: 403, headers: corsHeaders });
    }

    // Fetch the specific page
    const { data: page } = await supabase
      .from('publication_pages')
      .select('*')
      .eq('publication_id', publication.id)
      .eq('page_number', pageNumber)
      .single();

    if (!page) {
      return new Response('Page not found', { status: 404, headers: corsHeaders });
    }

    // If JSON format requested, return data
    if (format === 'json') {
      return new Response(
        JSON.stringify({
          publication: {
            id: publication.id,
            slug: publication.slug,
            title: publication.title,
            subtitle: publication.subtitle,
            description: publication.description,
            author: publication.author,
            pageCount: publication.page_count,
            visibility: publication.visibility,
            ogImageUrl: publication.og_image_url,
          },
          page: {
            pageNumber: page.page_number,
            textContent: page.text_content,
            renderLowUrl: page.render_low_url,
            renderHighUrl: page.render_high_url,
          },
          navigation: {
            hasPrev: pageNumber > 1,
            hasNext: pageNumber < publication.page_count,
            prevPage: pageNumber > 1 ? pageNumber - 1 : null,
            nextPage: pageNumber < publication.page_count ? pageNumber + 1 : null,
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Generate SEO-friendly HTML
    const seo = publication.seo || {};
    const metaTitle = seo.title || `${publication.title} – Page ${pageNumber}`;
    const metaDescription = seo.description || 
      (page.text_content ? page.text_content.substring(0, 160).replace(/\s+/g, ' ').trim() + '...' : publication.description || '');
    const canonicalUrl = seo.canonical || `https://your-domain.com/p/${publication.slug}/page/${pageNumber}`;
    const noindex = publication.visibility === 'unlisted' || seo.noindex;
    const ogImage = page.render_high_url || publication.og_image_url || '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(metaTitle)}</title>
  <meta name="description" content="${escapeHtml(metaDescription)}">
  ${noindex ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow">'}
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  
  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(metaTitle)}">
  <meta property="og:description" content="${escapeHtml(metaDescription)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ''}
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(metaTitle)}">
  <meta name="twitter:description" content="${escapeHtml(metaDescription)}">
  ${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}">` : ''}
  
  <style>
    :root {
      --bg: #fafafa;
      --text: #1a1a1a;
      --muted: #666;
      --border: #e5e5e5;
      --primary: #0066cc;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1a1a1a;
        --text: #fafafa;
        --muted: #999;
        --border: #333;
        --primary: #4da6ff;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
    }
    header { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
    h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
    .subtitle { color: var(--muted); font-size: 1.1rem; }
    .page-indicator { color: var(--muted); font-size: 0.9rem; margin-top: 0.5rem; }
    .content { margin: 2rem 0; white-space: pre-wrap; }
    .page-image { max-width: 100%; height: auto; margin: 1rem 0; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    nav { display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-top: 1px solid var(--border); margin-top: 2rem; }
    a { color: var(--primary); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .nav-disabled { color: var(--muted); pointer-events: none; }
    .read-flipbook { display: inline-block; background: var(--primary); color: white; padding: 0.75rem 1.5rem; border-radius: 6px; margin-top: 1rem; }
    .read-flipbook:hover { opacity: 0.9; text-decoration: none; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(publication.title)}</h1>
    ${publication.subtitle ? `<p class="subtitle">${escapeHtml(publication.subtitle)}</p>` : ''}
    ${publication.author ? `<p class="subtitle">By ${escapeHtml(publication.author)}</p>` : ''}
    <p class="page-indicator">Page ${pageNumber} of ${publication.page_count}</p>
    <a href="/p/${publication.slug}" class="read-flipbook">Read as Flipbook</a>
  </header>
  
  <main>
    ${page.render_high_url ? `<img src="${escapeHtml(page.render_high_url)}" alt="Page ${pageNumber}" class="page-image" loading="lazy">` : ''}
    
    <article class="content">
      ${page.text_content ? escapeHtml(page.text_content) : '<p><em>Text content not available for this page.</em></p>'}
    </article>
  </main>
  
  <nav>
    ${pageNumber > 1 
      ? `<a href="/p/${publication.slug}/page/${pageNumber - 1}">← Previous Page</a>`
      : `<span class="nav-disabled">← Previous Page</span>`}
    <a href="/p/${publication.slug}">View All Pages</a>
    ${pageNumber < publication.page_count 
      ? `<a href="/p/${publication.slug}/page/${pageNumber + 1}">Next Page →</a>`
      : `<span class="nav-disabled">Next Page →</span>`}
  </nav>
  
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${escapeJson(metaTitle)}",
    "description": "${escapeJson(metaDescription)}",
    ${publication.author ? `"author": {"@type": "Person", "name": "${escapeJson(publication.author)}"},` : ''}
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "${escapeJson(canonicalUrl)}"
    }
    ${ogImage ? `,"image": "${escapeJson(ogImage)}"` : ''}
  }
  </script>
</body>
</html>`;

    return new Response(html, { 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      },
      status: 200 
    });

  } catch (error) {
    console.error('Error generating SEO page:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJson(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
