import { useState } from "react";
import { Collection } from "@/hooks/use-collections";
import { Document } from "@/hooks/use-documents";
// Removed: import { Artist } from "@/hooks/useArtists";
import { createCollectionPDF } from "@/lib/create-collection-pdf";
import { toast } from "sonner";
import { UseMutationResult } from "@tanstack/react-query";
import { CollectionWebsite, CreateCollectionWebsitePayload } from "@/types/collection-website";
import { useNavigate } from "react-router-dom";

// Define a type for the artist data actually needed by this hook
interface DialogArtist {
  id: string;
  full_name: string;
}

interface UseCollectionDialogStateProps {
  collection: Collection | undefined;
  documents: Document[] | undefined;
  artists: DialogArtist[] | undefined; // Use the new simpler type
  createCollectionWebsiteMutation: UseMutationResult<CollectionWebsite, Error, CreateCollectionWebsitePayload, unknown>;
}

export function useCollectionDialogState({
  collection,
  documents,
  artists, // This will now correctly type the incoming data
  createCollectionWebsiteMutation,
}: UseCollectionDialogStateProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isCreatingWebsite, setIsCreatingWebsite] = useState(false);
  const navigate = useNavigate();

  const handleDocumentDownload = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllDocuments = () => {
    documents?.forEach(doc => {
      handleDocumentDownload(doc.file_url, doc.file_name);
    });
  };

  const handleGeneratePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      if (collection) {
        await createCollectionPDF(collection, "classic", true);
        toast.success("Collection PDF created successfully");
      } else {
        toast.error("No collection selected to create PDF");
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error("Failed to generate PDF");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const getArtistName = (artistId: string | null): string => {
    if (!artistId || !artists) return "Unknown Artist";
    const artist = artists.find(a => a.id === artistId);
    return artist ? artist.full_name : "Unknown Artist";
  };

  const handleCreateWebsite = async () => {
    if (!collection) {
      toast.error("No collection selected to create a website for.");
      return;
    }
    setIsCreatingWebsite(true);
    try {
      const newWebsite = await createCollectionWebsiteMutation.mutateAsync({
        collection_id: collection.id,
        collection_name: collection.name,
      });
      toast.success(`Website "${newWebsite.name || newWebsite.slug}" created successfully!`);
      navigate('/manage-websites');
    } catch (error) {
      console.error('Error creating website:', error);
      toast.error("Failed to create website. Please try again.");
    } finally {
      setIsCreatingWebsite(false);
    }
  };

  return {
    isGeneratingPDF,
    isCreatingWebsite,
    handleDocumentDownload,
    handleDownloadAllDocuments,
    handleGeneratePDF,
    getArtistName,
    handleCreateWebsite,
  };
}
