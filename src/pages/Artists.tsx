
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArtistHeader } from "@/components/artists/ArtistHeader";
import { SearchBar } from "@/components/artists/SearchBar";
import { ArtistCard } from "@/components/artists/ArtistCard";
import { LoadingSkeleton } from "@/components/artists/LoadingSkeleton";

interface Artist {
  id: string;
  full_name: string;
  birth_year: number | null;
  nationality: string | null;
  representation_status: string;
  image_url: string | null;
}

const Artists = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: artists, isLoading } = useQuery({
    queryKey: ['artists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('artists')
        .select('*')
        .order('full_name');
      
      if (error) throw error;
      return data as Artist[];
    }
  });

  const filteredArtists = artists?.filter(artist => 
    artist.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (artist.nationality && artist.nationality.toLowerCase().includes(searchTerm.toLowerCase()))
  ) ?? [];

  return (
    <div className="pt-2 pb-4 px-2 sm:px-0">
      <ArtistHeader />
      <SearchBar value={searchTerm} onChange={setSearchTerm} />
      
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArtists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Artists;
