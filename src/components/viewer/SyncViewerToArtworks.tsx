import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

const MIKE_MEIRE_ARTIST_ID = "57739d6a-9f26-445b-bb29-43775edbf029";

export function SyncViewerToArtworks() {
  const [isSyncing, setIsSyncing] = useState(false);

  const syncArtworks = async () => {
    setIsSyncing(true);
    
    try {
      // Fetch all viewer artworks with their images
      const { data: viewerArtworks, error: fetchError } = await supabase
        .from("viewer_artworks")
        .select(`
          id,
          title,
          year,
          artist_name,
          images:viewer_artwork_images(
            id,
            original_url,
            width,
            height,
            position
          )
        `)
        .order("created_at");

      if (fetchError) throw fetchError;

      if (!viewerArtworks || viewerArtworks.length === 0) {
        toast.info("No viewer artworks to sync");
        return;
      }

      let addedCount = 0;
      let skippedCount = 0;

      for (const viewerArtwork of viewerArtworks) {
        // Check if artwork already exists (by title + artist)
        const { data: existing } = await supabase
          .from("artworks")
          .select("id")
          .eq("title", viewerArtwork.title)
          .eq("artist_id", MIKE_MEIRE_ARTIST_ID)
          .maybeSingle();

        if (existing) {
          skippedCount++;
          continue;
        }

        // Get primary image URL
        const images = viewerArtwork.images || [];
        const primaryImage = images.find((img: any) => img.position === 0) || images[0];
        const imageUrl = primaryImage?.original_url || null;

        // Insert the artwork
        const { data: newArtwork, error: insertError } = await supabase
          .from("artworks")
          .insert({
            title: viewerArtwork.title,
            artist_id: MIKE_MEIRE_ARTIST_ID,
            year: viewerArtwork.year ? parseInt(viewerArtwork.year) : null,
            image_url: imageUrl,
            medium_type: "Painting",
            classification: "Unique",
            currency: "EUR",
            status: "Available",
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("Error inserting artwork:", insertError);
          continue;
        }

        // Insert all images for this artwork
        if (images.length > 0 && newArtwork) {
          const imageInserts = images.map((img: any, index: number) => ({
            artwork_id: newArtwork.id,
            image_url: img.original_url,
            is_primary: img.position === 0 || index === 0,
            display_order: img.position ?? index,
            processed: false,
            processing_status: "pending",
          }));

          const { error: imagesError } = await supabase
            .from("artwork_images")
            .insert(imageInserts);

          if (imagesError) {
            console.error("Error inserting images:", imagesError);
          }
        }

        addedCount++;
      }

      toast.success(`Synced ${addedCount} artworks to inventory (${skippedCount} already existed)`);
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Failed to sync artworks");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button 
      onClick={syncArtworks} 
      disabled={isSyncing}
      variant="outline"
      size="sm"
    >
      {isSyncing ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Upload className="h-4 w-4 mr-2" />
      )}
      Sync to Artworks
    </Button>
  );
}
