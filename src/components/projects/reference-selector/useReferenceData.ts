
import { useArtists } from "@/hooks/useArtists";
import { useArtworks } from "@/hooks/use-artworks";
import { useCollections } from "@/hooks/use-collections";
import { useDocuments } from "@/hooks/use-documents";

export function useReferenceData(searchTerm: string) {
  const { data: artists, isLoading: artistsLoading } = useArtists();
  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const { data: artworks, isLoading: artworksLoading } = useArtworks();
  const { data: documents, isLoading: documentsLoading } = useDocuments();

  const lowerSearchTerm = searchTerm.toLowerCase();

  const filteredArtists = artists?.filter(a => 
    a.full_name.toLowerCase().includes(lowerSearchTerm)
  ) || [];
  
  const filteredCollections = collections?.filter(c => 
    c.name.toLowerCase().includes(lowerSearchTerm)
  ) || [];
  
  const filteredArtworks = artworks?.filter(a => 
    a.title.toLowerCase().includes(lowerSearchTerm)
  ) || [];
  
  const filteredDocuments = documents?.filter(d => 
    d.file_name.toLowerCase().includes(lowerSearchTerm)
  ) || [];

  return {
    artists: { data: filteredArtists, isLoading: artistsLoading },
    collections: { data: filteredCollections, isLoading: collectionsLoading },
    artworks: { data: filteredArtworks, isLoading: artworksLoading },
    documents: { data: filteredDocuments, isLoading: documentsLoading },
  };
}
