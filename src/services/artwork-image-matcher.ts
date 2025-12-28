import { supabase } from "@/integrations/supabase/client";
import { ExcelRow } from "@/lib/excel/parse-excel";

export interface ArtworkMatch {
  excelRow: ExcelRow;
  artworkId: string | null;
  artworkTitle: string | null;
  artistName: string | null;
  imageUrl: string | null;
  matchConfidence: 'exact' | 'high' | 'medium' | 'low' | 'none';
  hasExistingImages: boolean;
  currentImageUrl: string | null;
}

export interface MatchResult {
  matches: ArtworkMatch[];
  matchedCount: number;
  unmatchedCount: number;
  withImagesCount: number;
}

interface ArtworkRecord {
  id: string;
  title: string;
  year: number | null;
  image_url: string | null;
  artist: {
    full_name: string;
  } | null;
  artwork_images: {
    id: string;
  }[];
}

function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8;
  }
  
  // Simple word overlap
  const words1 = new Set(s1.split(' '));
  const words2 = new Set(s2.split(' '));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

export async function matchArtworksFromExcel(
  excelRows: ExcelRow[],
  titleColumn: string,
  artistColumn: string | null,
  yearColumn: string | null,
  imageUrlColumn: string
): Promise<MatchResult> {
  // Fetch all artworks with their images
  const { data: artworks, error } = await supabase
    .from('artworks')
    .select(`
      id,
      title,
      year,
      image_url,
      artist:artists(full_name),
      artwork_images(id)
    `)
    .order('title');
  
  if (error) {
    throw new Error(`Failed to fetch artworks: ${error.message}`);
  }

  const matches: ArtworkMatch[] = [];
  let matchedCount = 0;
  let withImagesCount = 0;

  for (const row of excelRows) {
    const excelTitle = String(row[titleColumn] || '').trim();
    const excelArtist = artistColumn ? String(row[artistColumn] || '').trim() : '';
    const excelYear = yearColumn ? row[yearColumn] : null;
    const imageUrl = String(row[imageUrlColumn] || '').trim();

    if (!excelTitle) {
      matches.push({
        excelRow: row,
        artworkId: null,
        artworkTitle: null,
        artistName: null,
        imageUrl: imageUrl || null,
        matchConfidence: 'none',
        hasExistingImages: false,
        currentImageUrl: null
      });
      continue;
    }

    // Find best matching artwork
    let bestMatch: ArtworkRecord | null = null;
    let bestConfidence: 'exact' | 'high' | 'medium' | 'low' | 'none' = 'none';
    let bestScore = 0;

    for (const artwork of artworks || []) {
      const titleSimilarity = calculateSimilarity(excelTitle, artwork.title);
      const artistName = artwork.artist?.full_name || '';
      const artistSimilarity = artistColumn ? calculateSimilarity(excelArtist, artistName) : 0;
      
      // Calculate combined score
      let score = titleSimilarity * 0.6;
      if (artistColumn) {
        score += artistSimilarity * 0.3;
      } else {
        score = titleSimilarity;
      }
      
      // Year bonus
      if (yearColumn && excelYear && artwork.year) {
        const excelYearNum = parseInt(String(excelYear));
        if (!isNaN(excelYearNum) && excelYearNum === artwork.year) {
          score += 0.1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = artwork;
        
        // Determine confidence level
        if (titleSimilarity === 1 && (!artistColumn || artistSimilarity > 0.8)) {
          bestConfidence = 'exact';
        } else if (score >= 0.8) {
          bestConfidence = 'high';
        } else if (score >= 0.5) {
          bestConfidence = 'medium';
        } else if (score >= 0.3) {
          bestConfidence = 'low';
        } else {
          bestConfidence = 'none';
        }
      }
    }

    const hasImages = bestMatch ? (bestMatch.artwork_images?.length > 0 || !!bestMatch.image_url) : false;
    
    if (bestConfidence !== 'none') {
      matchedCount++;
    }
    if (hasImages) {
      withImagesCount++;
    }

    matches.push({
      excelRow: row,
      artworkId: bestMatch?.id || null,
      artworkTitle: bestMatch?.title || null,
      artistName: bestMatch?.artist?.full_name || null,
      imageUrl: imageUrl || null,
      matchConfidence: bestConfidence,
      hasExistingImages: hasImages,
      currentImageUrl: bestMatch?.image_url || null
    });
  }

  return {
    matches,
    matchedCount,
    unmatchedCount: matches.length - matchedCount,
    withImagesCount
  };
}

export async function importImageUrlsForArtworks(
  matches: ArtworkMatch[],
  onlyMissing: boolean = true
): Promise<{ success: number; failed: number; skipped: number }> {
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const match of matches) {
    // Skip if no artwork match or no image URL
    if (!match.artworkId || !match.imageUrl || match.matchConfidence === 'none') {
      skipped++;
      continue;
    }

    // Skip if artwork already has images and we only want missing
    if (onlyMissing && match.hasExistingImages) {
      skipped++;
      continue;
    }

    try {
      // Create artwork_images entry with the URL
      const { error: insertError } = await supabase
        .from('artwork_images')
        .insert({
          artwork_id: match.artworkId,
          image_url: match.imageUrl,
          is_primary: !match.hasExistingImages, // Make primary if no existing images
          display_order: 0,
          processed: false
        });

      if (insertError) {
        // If insert fails, try updating the artwork's image_url directly
        const { error: updateError } = await supabase
          .from('artworks')
          .update({ image_url: match.imageUrl })
          .eq('id', match.artworkId);

        if (updateError) {
          throw updateError;
        }
      }

      success++;
    } catch (error) {
      console.error(`Failed to import image for artwork ${match.artworkId}:`, error);
      failed++;
    }
  }

  return { success, failed, skipped };
}
