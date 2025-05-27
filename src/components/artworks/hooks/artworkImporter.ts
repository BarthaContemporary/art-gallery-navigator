
import { supabase } from "@/integrations/supabase/client";
import { ProcessedArtworkForImport } from "@/components/artworks/ArtworkFieldMapping.types";
import { ImportStats } from "@/components/artworks/import-steps/types";
import { toast } from "sonner";
import { Artist } from "@/hooks/useArtists"; // Import Artist type

type ArtworkInsertData = Omit<ProcessedArtworkForImport, 'id' | 'artist_name'>;

// Helper function to derive surname's first letter
function getSurnameFirstLetter(fullName: string | null | undefined): string | null {
  if (!fullName || fullName.trim() === "") return null;
  const parts = fullName.trim().split(/\s+/);
  const lastName = parts.pop();
  return lastName ? lastName.charAt(0).toUpperCase() : fullName.charAt(0).toUpperCase();
}

export async function performArtworkImport(
  artworksToImport: ProcessedArtworkForImport[],
  onProgress: (progress: number) => void,
  onStatsUpdate: (stats: Pick<ImportStats, 'successful' | 'failed' | 'skipped'>) => void
): Promise<Pick<ImportStats, 'successful' | 'failed' | 'skipped'>> {
  let successful = 0;
  let failed = 0;
  let skipped = 0;
  const total = artworksToImport.length;

  const artistNameToIdCache = new Map<string, string>();

  // Fetch all existing artists once to minimize DB calls in loop for matching
  const { data: existingArtists, error: artistsFetchError } = await supabase
    .from("artists")
    .select("id, full_name");

  if (artistsFetchError) {
    toast.error("Failed to fetch existing artists. Artist matching might be affected.");
    console.error("Error fetching artists:", artistsFetchError);
  } else if (existingArtists) {
    existingArtists.forEach(artist => {
      if (artist.full_name) {
        artistNameToIdCache.set(artist.full_name.toLowerCase(), artist.id);
      }
    });
  }


  for (let i = 0; i < total; i++) {
    const artwork = artworksToImport[i];
    let currentArtistId = artwork.artist_id || null;

    // Resolve artist_id if artist_name is provided and artist_id is not
    if (!currentArtistId && artwork.artist_name && typeof artwork.artist_name === 'string' && artwork.artist_name.trim() !== "") {
      const artistNameLower = artwork.artist_name.toLowerCase();
      if (artistNameToIdCache.has(artistNameLower)) {
        currentArtistId = artistNameToIdCache.get(artistNameLower)!;
      } else {
        // Try a case-insensitive query to DB as a fallback (e.g. if cache wasn't populated or name has slight variations not caught by toLowerCase)
        const { data: foundArtist, error: findArtistError } = await supabase
          .from("artists")
          .select("id")
          .ilike("full_name", artwork.artist_name)
          .maybeSingle();

        if (findArtistError) {
          console.error(`Error finding artist "${artwork.artist_name}":`, findArtistError);
          toast.warning(`Could not verify artist "${artwork.artist_name}". Attempting to create.`);
        }

        if (foundArtist) {
          currentArtistId = foundArtist.id;
          artistNameToIdCache.set(artistNameLower, foundArtist.id); // Update cache
        } else {
          // Artist not found, create new one
          const surnameLetter = getSurnameFirstLetter(artwork.artist_name);
          const { data: newArtist, error: createArtistError } = await supabase
            .from("artists")
            .insert({
              full_name: artwork.artist_name,
              surname_first_letter: surnameLetter,
              // Add other default fields for an artist if necessary
              // representation_status: 'not represented' // This is default in DB
            })
            .select("id")
            .single();
          
          if (createArtistError) {
            console.error(`Error creating new artist "${artwork.artist_name}":`, createArtistError);
            toast.error(`Failed to create artist: ${artwork.artist_name}. Skipping artwork.`);
            failed++;
            onProgress(((i + 1) / total) * 100);
            onStatsUpdate({ successful, failed, skipped });
            continue; // Skip this artwork
          }
          if (newArtist) {
            currentArtistId = newArtist.id;
            artistNameToIdCache.set(artistNameLower, newArtist.id); // Add to cache
            toast.success(`New artist created: ${artwork.artist_name}`);
          }
        }
      }
    }
    
    // Now, `currentArtistId` should be resolved (or null if no name/id was provided or creation failed)
    // The original `artwork.artist_id` should be updated for the duplicate check and insert.
    const resolvedArtwork = { ...artwork, artist_id: currentArtistId };


    // Duplicate Check: Exact title match with same artist
    if (resolvedArtwork.title && resolvedArtwork.title.trim() !== "") {
      const { data: existingDBArtwork, error: checkError } = await supabase
        .from("artworks")
        .select("id")
        .eq("title", resolvedArtwork.title)
        .eq("artist_id", resolvedArtwork.artist_id) // Use resolved artist_id
        .maybeSingle();

      if (checkError) {
        console.error("Error checking for duplicate artwork:", resolvedArtwork.title, checkError);
        toast.warning(`Error checking duplicate for ${resolvedArtwork.title}. Will attempt import.`);
      } else if (existingDBArtwork) {
        console.log("Duplicate found, skipping artwork:", resolvedArtwork.title, "Artist ID:", resolvedArtwork.artist_id);
        skipped++;
        onProgress(((i + 1) / total) * 100);
        onStatsUpdate({ successful, failed, skipped });
        continue; 
      }
    } else {
      console.warn("Artwork title is empty, cannot perform reliable duplicate check based on title:", resolvedArtwork);
    }
    
    const { id, artist_name, ...artworkFieldsToInsert } = resolvedArtwork;
    
    const dataToInsert: ArtworkInsertData = {
      ...artworkFieldsToInsert,
      artist_id: currentArtistId, // Ensure this is the resolved ID
      title: artworkFieldsToInsert.title!, 
      classification: artworkFieldsToInsert.classification!,
      medium_type: artworkFieldsToInsert.medium_type!,
      currency: artworkFieldsToInsert.currency!,
    };

    try {
      const { error } = await supabase.from("artworks").insert(dataToInsert as any); 
                                                                                    
      if (error) {
        console.error("Error importing artwork:", resolvedArtwork.title, error.message, error.details, error.hint);
        toast.error(`Failed to import ${resolvedArtwork.title}: ${error.message}`);
        failed++;
      } else {
        successful++;
      }
    } catch (dbError: any) {
      console.error("Database Error importing artwork:", resolvedArtwork.title, dbError);
      toast.error(`DB error importing ${resolvedArtwork.title}: ${dbError.message}`);
      failed++;
    }
    
    onProgress(((i + 1) / total) * 100);
    onStatsUpdate({ successful, failed, skipped });
  }
  
  return { successful, failed, skipped };
}

