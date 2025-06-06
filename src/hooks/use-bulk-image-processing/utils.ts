
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { UnprocessedCounts } from "./types";

export async function getUnprocessedCounts(): Promise<UnprocessedCounts> {
  // Get all unprocessed artwork images
  const { data: unprocessedImages, error: artworkError } = await supabase
    .from('artwork_images')
    .select('id, image_url')
    .eq('processed', false);

  if (artworkError) {
    throw artworkError;
  }

  // Get all artists with image_url that haven't been processed through Cloudinary
  const { data: artistsWithImages, error: artistError } = await supabase
    .from('artists')
    .select('id, image_url')
    .not('image_url', 'is', null)
    .neq('image_url', '');

  if (artistError) {
    throw artistError;
  }

  // Filter out artists whose images are already processed through Cloudinary
  const unprocessedArtists = artistsWithImages?.filter(artist => 
    artist.image_url && !artist.image_url.includes('res.cloudinary.com')
  ) || [];

  const artworkCount = unprocessedImages?.length || 0;
  const artistCount = unprocessedArtists.length;
  const totalImages = artworkCount + artistCount;

  return {
    artworkCount,
    artistCount,
    totalImages
  };
}

export async function getUnprocessedCountForDisplay(): Promise<number> {
  try {
    const { count: artworkCount, error: artworkError } = await supabase
      .from('artwork_images')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);

    if (artworkError) {
      throw artworkError;
    }

    // Get artists with non-Cloudinary image URLs (unprocessed)
    const { data: artistsWithImages, error: artistError } = await supabase
      .from('artists')
      .select('image_url')
      .not('image_url', 'is', null)
      .neq('image_url', '');

    if (artistError) {
      throw artistError;
    }

    const unprocessedArtists = artistsWithImages?.filter(artist => 
      artist.image_url && !artist.image_url.includes('res.cloudinary.com')
    ) || [];

    return (artworkCount || 0) + unprocessedArtists.length;
  } catch (error) {
    logger.error('Failed to get unprocessed count:', error);
    return 0;
  }
}
