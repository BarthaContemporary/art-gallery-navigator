
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface Artist {
  id: string;
  full_name: string;
  surname_first_letter?: string | null;
  birth_year: number | null;
  death_year?: number | null;
  place_of_birth?: string | null;
  place_of_death?: string | null;
  nationality: string | null;
  representation_status: string;
  biography: string | null;
  image_url: string | null;
  email?: string | null;
}

type RepresentationStatusFilterType = "all" | "represented" | "formerly represented" | "not represented";
type ViewMode = 'grid' | 'list';

export const useArtistsPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [createArtistDialogOpen, setCreateArtistDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<RepresentationStatusFilterType>("all");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('artists-view-mode') as ViewMode) || 'grid';
  });
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const {
    data: artists,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['artists', statusFilter],
    queryFn: async () => {
      console.log('Fetching artists for mobile...');
      let query = supabase.from('artists').select('*').order('full_name');
      if (statusFilter !== "all") {
        query = query.eq('representation_status', statusFilter);
      }
      const { data, error } = await query;
      if (error) {
        console.error('Error fetching artists:', error);
        throw error;
      }
      console.log(`Successfully fetched ${data?.length || 0} artists`);
      return data as Artist[];
    },
    retry: 3,
    retryDelay: 1000
  });

  const filteredArtists = artists?.filter(artist => {
    const searchTermLower = searchTerm.toLowerCase();
    const matchesSearchTerm =
      artist.full_name.toLowerCase().includes(searchTermLower) ||
      (artist.nationality && artist.nationality.toLowerCase().includes(searchTermLower)) ||
      (artist.email && artist.email.toLowerCase().includes(searchTermLower)) ||
      (artist.surname_first_letter && artist.surname_first_letter.toLowerCase().includes(searchTermLower)) ||
      (artist.place_of_birth && artist.place_of_birth.toLowerCase().includes(searchTermLower)) ||
      (artist.place_of_death && artist.place_of_death.toLowerCase().includes(searchTermLower));

    return matchesSearchTerm;
  }) ?? [];

  const handleRefresh = async () => {
    try {
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['artists'] });
      toast.success("Artists refreshed successfully");
    } catch (error) {
      console.error('Refresh error:', error);
      toast.error("Failed to refresh artists");
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('artists-view-mode', mode);
  };

  return {
    searchTerm,
    setSearchTerm,
    createArtistDialogOpen,
    setCreateArtistDialogOpen,
    statusFilter,
    setStatusFilter,
    viewMode,
    handleViewModeChange,
    isMobile,
    artists,
    filteredArtists,
    isLoading,
    error,
    handleRefresh
  };
};
