
import { supabase } from "@/integrations/supabase/client";
import { ProcessedArtworkForImport } from "@/components/artworks/ArtworkFieldMapping.types";
import { ImportStats } from "@/components/artworks/import-steps/types";
import { toast } from "sonner";

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
  console.log("Starting artwork import process with", artworksToImport.length, "artworks");
  
  let successful = 0;
  let failed = 0;
  let skipped = 0;
  const total = artworksToImport.length;

  const artistNameToIdCache = new Map<string, string>();

  try {
    // Fetch all existing artists once to minimize DB calls in loop for matching
    console.log("Fetching existing artists...");
    const { data: existingArtists, error: artistsFetchError } = await supabase
      .from("artists")
      .select("id, full_name");

    if (artistsFetchError) {
      console.error("Error fetching artists:", artistsFetchError);
      toast.error("Failed to fetch existing artists. Artist matching might be affected.");
    } else if (existingArtists) {
      console.log("Found", existingArtists.length, "existing artists");
      existingArtists.forEach(artist => {
        if (artist.full_name) {
          artistNameToIdCache.set(artist.full_name.toLowerCase(), artist.id);
        }
      });
    }
  } catch (error) {
    console.error("Error setting up artist cache:", error);
    toast.error("Error setting up artist data. Continuing with import...");
  }

  for (let i = 0; i < total; i++) {
    const artwork = artworksToImport[i];
    console.log(`Processing artwork ${i + 1}/${total}:`, artwork.title);
    
    let currentArtistId = artwork.artist_id || null;

    try {
      // Resolve artist_id if artist_name is provided and artist_id is not
      if (!currentArtistId && artwork.artist_name && typeof artwork.artist_name === 'string' && artwork.artist_name.trim() !== "") {
        console.log("Resolving artist for name:", artwork.artist_name);
        
        const artistNameLower = artwork.artist_name.toLowerCase();
        if (artistNameToIdCache.has(artistNameLower)) {
          currentArtistId = artistNameToIdCache.get(artistNameLower)!;
          console.log("Found artist in cache:", currentArtistId);
        } else {
          // Try a case-insensitive query to DB as a fallback
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
            console.log("Found artist in database:", currentArtistId);
          } else {
            // Artist not found, create new one
            console.log("Creating new artist:", artwork.artist_name);
            const surnameLetter = getSurnameFirstLetter(artwork.artist_name);
            const { data: newArtist, error: createArtistError } = await supabase
              .from("artists")
              .insert({
                full_name: artwork.artist_name,
                surname_first_letter: surnameLetter,
                representation_status: 'not represented'
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
              console.log("Created new artist:", currentArtistId);
              toast.success(`New artist created: ${artwork.artist_name}`);
            }
          }
        }
      }
      
      // Now, `currentArtistId` should be resolved (or null if no name/id was provided or creation failed)
      const resolvedArtwork = { ...artwork, artist_id: currentArtistId };

      // Duplicate Check: Exact title match with same artist
      if (resolvedArtwork.title && resolvedArtwork.title.trim() !== "") {
        console.log("Checking for duplicates:", resolvedArtwork.title, "with artist:", resolvedArtwork.artist_id);
        
        const { data: existingDBArtwork, error: checkError } = await supabase
          .from("artworks")
          .select("id")
          .eq("title", resolvedArtwork.title)
          .eq("artist_id", resolvedArtwork.artist_id)
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
      
      // Prepare data for insertion
      const { id, artist_name, ...artworkFieldsToInsert } = resolvedArtwork;
      
      const dataToInsert: ArtworkInsertData = {
        ...artworkFieldsToInsert,
        artist_id: currentArtistId,
        title: artworkFieldsToInsert.title!, 
        classification: artworkFieldsToInsert.classification!,
        medium_type: artworkFieldsToInsert.medium_type!,
        currency: artworkFieldsToInsert.currency!,
      };

      console.log("Inserting artwork data:", dataToInsert);

      const { data: insertedArtwork, error } = await supabase
        .from("artworks")
        .insert(dataToInsert as any)
        .select("id, image_url")
        .single();
                                                                                       
      if (error) {
        console.error("Error importing artwork:", resolvedArtwork.title, error.message, error.details, error.hint);
        toast.error(`Failed to import ${resolvedArtwork.title}: ${error.message}`);
        failed++;
      } else {
        console.log("Successfully imported artwork:", resolvedArtwork.title);
        successful++;

        // If artwork has an image_url, also create an artwork_images record so it displays in the UI
        if (insertedArtwork?.image_url) {
          const { error: imageError } = await supabase
            .from("artwork_images")
            .insert({
              artwork_id: insertedArtwork.id,
              image_url: insertedArtwork.image_url,
              is_primary: true,
              display_order: 0,
            });
          if (imageError) {
            console.warn("Artwork imported but failed to create image record:", imageError.message);
          } else {
            console.log("Created artwork_images record for:", resolvedArtwork.title);
          }
        }
      }

    } catch (dbError: any) {
      console.error("Database Error importing artwork:", artwork.title, dbError);
      toast.error(`DB error importing ${artwork.title}: ${dbError.message}`);
      failed++;
    }
    
    onProgress(((i + 1) / total) * 100);
    onStatsUpdate({ successful, failed, skipped });
  }
  
  console.log("Import completed. Stats:", { successful, failed, skipped });
  return { successful, failed, skipped };
}
