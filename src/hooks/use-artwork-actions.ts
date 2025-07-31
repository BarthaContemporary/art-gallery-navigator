
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Artwork } from "@/hooks/use-artworks";

export function useArtworkActions(artwork: Artwork | null) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isOverviewDialogOpen, setIsOverviewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleView = () => {
    setIsOverviewDialogOpen(true);
  };

  const handleEdit = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsEditDialogOpen(true);
  };

  const checkCollections = async (artworkId: string) => {
    const { data: collections } = await supabase
      .from("collection_artworks")
      .select("collection_id, collections(name)")
      .eq("artwork_id", artworkId);

    return collections || [];
  };

  const handleDelete = async () => {
    if (!artwork) return false;
    
    try {
      setIsDeleting(true);
      
      // Check if artwork is in any collections
      const collections = await checkCollections(artwork.id);
      
      if (collections.length > 0) {
        const collectionNames = collections
          .map((c: any) => c.collections.name)
          .join(", ");
        
        if (!window.confirm(
          `This artwork is currently displayed in the following collections: ${collectionNames}.\n\nAre you sure you want to delete it? The artwork will be automatically removed from these collections.`
        )) {
          return false;
        }

        // Remove artwork from all collections it's in
        const { error: unlinkError } = await supabase
          .from("collection_artworks")
          .delete()
          .eq("artwork_id", artwork.id);

        if (unlinkError) throw unlinkError;
      }

      // Delete the artwork itself
      const { error } = await supabase
        .from('artworks')
        .delete()
        .eq('id', artwork.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['artworks'] });
      await queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast.success("Artwork deleted successfully");
      setIsDeleteDialogOpen(false);
      return true;
    } catch (error) {
      console.error('Error deleting artwork:', error);
      toast.error("Failed to delete artwork");
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDuplicate = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!artwork) return false;
    
    try {
      const artworkCopy = {
        title: `${artwork.title} (Copy)`,
        artist_id: artwork.artist_id,
        year: artwork.year,
        medium_type: artwork.medium_type,
        materials: artwork.materials,
        classification: artwork.classification,
        edition_size: artwork.edition_size,
        dimensions: artwork.dimensions,
        price: artwork.price,
        currency: artwork.currency,
        status: artwork.status,
        image_url: artwork.image_url,
        location_id: artwork.location_id,
        inventory_quantity: artwork.inventory_quantity,
        available_works: artwork.available_works,
        artist_proofs: artwork.artist_proofs,
        signature_type: artwork.signature_type,
        condition: artwork.condition,
        signature_details: artwork.signature_details,
        provenance: artwork.provenance,
        story: artwork.story,
        exhibition_history: artwork.exhibition_history,
        ai_description: artwork.ai_description,
        height: artwork.height,
        width: artwork.width,
        depth: artwork.depth,
        is_framed: artwork.is_framed,
        frame_height: artwork.frame_height,
        frame_width: artwork.frame_width,
        frame_depth: artwork.frame_depth,
        weight: artwork.weight,
        has_crate: artwork.has_crate,
        crate_height: artwork.crate_height,
        crate_width: artwork.crate_width,
        crate_depth: artwork.crate_depth,
      };

      const { error } = await supabase
        .from('artworks')
        .insert([artworkCopy]);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['artworks'] });
      toast.success("Artwork duplicated successfully");
      return true;
    } catch (error) {
      console.error('Error duplicating artwork:', error);
      toast.error("Failed to duplicate artwork");
      return false;
    }
  };

  const handleExport = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!artwork) return;
    
    try {
      // Simple CSV export of single artwork
      const csvContent = [
        'Title,Artist,Year,Medium,Price,Status',
        `"${artwork.title}","${artwork.artist_id || 'Unknown'}","${artwork.year || ''}","${artwork.medium_type}","${artwork.price || ''}","${artwork.status}"`
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${artwork.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success("Artwork exported successfully");
    } catch (error) {
      console.error('Error exporting artwork:', error);
      toast.error("Failed to export artwork");
    }
  };

  return {
    // Action handlers
    handleView,
    handleEdit,
    handleDelete,
    handleDuplicate,
    handleExport,
    
    // State
    isDeleting,
    
    // Dialog states
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isOverviewDialogOpen,
    setIsOverviewDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
  };
}
