import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function err(status: number, message: string) {
  return json({ error: message }, status);
}

type ArtworkRow = Record<string, unknown> & {
  id: string;
  artist_id: string | null;
  artists?: { id: string; full_name: string } | null;
  artwork_images?: Array<{
    id: string;
    image_url: string;
    thumbnail_url: string | null;
    medium_url: string | null;
    is_primary: boolean;
    display_order: number;
  }>;
};

function shapeArtwork(a: ArtworkRow) {
  const images = (a.artwork_images ?? [])
    .slice()
    .sort((x, y) => Number(y.is_primary) - Number(x.is_primary) || x.display_order - y.display_order)
    .map((img) => ({
      id: img.id,
      url: img.image_url,
      thumbnail_url: img.thumbnail_url,
      medium_url: img.medium_url,
      is_primary: img.is_primary,
    }));

  return {
    id: a.id,
    title: a.title,
    artist: a.artists ? { id: a.artists.id, name: a.artists.full_name } : null,
    year: a.year,
    medium_type: a.medium_type,
    materials: a.materials,
    classification: a.classification,
    edition_size: a.edition_size,
    available_works: a.available_works,
    artist_proofs: a.artist_proofs,
    dimensions: {
      raw: a.dimensions,
      height: a.height,
      width: a.width,
      depth: a.depth,
      is_framed: a.is_framed,
      frame_height: a.frame_height,
      frame_width: a.frame_width,
      frame_depth: a.frame_depth,
    },
    price: a.price,
    currency: a.currency,
    status: a.status,
    condition: a.condition,
    story: a.story,
    provenance: a.provenance,
    exhibition_history: a.exhibition_history,
    signature_type: a.signature_type,
    signature_details: a.signature_details,
    primary_image: images[0]?.url ?? a.image_url ?? null,
    images,
    created_at: a.created_at,
    updated_at: a.updated_at,
  };
}

function shapeArtist(a: Record<string, unknown>) {
  return {
    id: a.id,
    name: a.full_name,
    biography: a.biography,
    nationality: a.nationality,
    birth_year: a.birth_year,
    death_year: a.death_year,
    place_of_birth: a.place_of_birth,
    place_of_death: a.place_of_death,
    image_url: a.image_url,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Auth: require x-api-key (header) or ?api_key= (query, for easy CMS testing)
  const url = new URL(req.url);
  const apiKey = req.headers.get('x-api-key') ?? url.searchParams.get('api_key');
  if (!apiKey) return err(401, 'Missing x-api-key header');

  const keyHash = await sha256(apiKey);
  const { data: keyRows, error: keyErr } = await admin.rpc('validate_inventory_api_key', { _key_hash: keyHash });
  if (keyErr) return err(500, `Key validation failed: ${keyErr.message}`);
  if (!keyRows || keyRows.length === 0) return err(401, 'Invalid or revoked API key');

  // Strip function prefix from path. Supabase routes /functions/v1/public-inventory-api/...
  const pathname = url.pathname.replace(/^.*?public-inventory-api/, '') || '/';
  const segments = pathname.split('/').filter(Boolean);

  try {
    if (req.method !== 'GET') return err(405, 'Method not allowed');

    // GET /artworks
    if (segments[0] === 'artworks' && segments.length === 1) {
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 200);
      const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0);
      const status = url.searchParams.get('status');
      const artistId = url.searchParams.get('artist_id');
      const medium = url.searchParams.get('medium_type');

      let q = admin
        .from('artworks')
        .select(`*, artists!inner(id, full_name), artwork_images(id, image_url, thumbnail_url, medium_url, is_primary, display_order)`, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (status) q = q.eq('status', status);
      if (artistId) q = q.eq('artist_id', artistId);
      if (medium) q = q.eq('medium_type', medium);

      const { data, count, error } = await q;
      if (error) return err(500, error.message);
      return json({
        data: (data as ArtworkRow[]).map(shapeArtwork),
        pagination: { limit, offset, total: count ?? null },
      });
    }

    // GET /artworks/:id
    if (segments[0] === 'artworks' && segments.length === 2) {
      const { data, error } = await admin
        .from('artworks')
        .select(`*, artists!inner(id, full_name), artwork_images(id, image_url, thumbnail_url, medium_url, is_primary, display_order)`)
        .eq('id', segments[1])
        .maybeSingle();
      if (error) return err(500, error.message);
      if (!data) return err(404, 'Artwork not found');
      return json({ data: shapeArtwork(data as ArtworkRow) });
    }

    // GET /artists
    if (segments[0] === 'artists' && segments.length === 1) {
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10) || 100, 500);
      const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0);
      const { data, count, error } = await admin
        .from('artists_public_inventory')
        .select('*', { count: 'exact' })
        .order('full_name', { ascending: true })
        .range(offset, offset + limit - 1);
      if (error) return err(500, error.message);
      return json({
        data: (data ?? []).map(shapeArtist),
        pagination: { limit, offset, total: count ?? null },
      });
    }

    // GET /artists/:id
    if (segments[0] === 'artists' && segments.length === 2) {
      const { data: artist, error } = await admin
        .from('artists_public_inventory')
        .select('*')
        .eq('id', segments[1])
        .maybeSingle();
      if (error) return err(500, error.message);
      if (!artist) return err(404, 'Artist not found');

      const { data: works } = await admin
        .from('artworks')
        .select(`*, artists!inner(id, full_name), artwork_images(id, image_url, thumbnail_url, medium_url, is_primary, display_order)`)
        .eq('artist_id', segments[1])
        .order('year', { ascending: false });

      return json({
        data: { ...shapeArtist(artist), artworks: ((works ?? []) as ArtworkRow[]).map(shapeArtwork) },
      });
    }

    // GET / -> simple index for discoverability
    if (segments.length === 0) {
      return json({
        name: 'Inventory API',
        version: '1.0',
        endpoints: [
          'GET /artworks?status=available&artist_id=&medium_type=&limit=50&offset=0',
          'GET /artworks/:id',
          'GET /artists?limit=100&offset=0',
          'GET /artists/:id',
        ],
      });
    }

    return err(404, 'Endpoint not found');
  } catch (e) {
    return err(500, e instanceof Error ? e.message : 'Internal error');
  }
});