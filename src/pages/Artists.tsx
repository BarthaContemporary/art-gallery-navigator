
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
  biography: string | null;
  image_url: string | null;
  email?: string | null;
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
    (artist.nationality && artist.nationality.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (artist.email && artist.email.toLowerCase().includes(searchTerm.toLowerCase()))
  ) ?? [];

  return (
    <div className="pt-6 pb-6 px-6">
      <ArtistHeader />
      <div className="mt-6 mb-8">
        <SearchBar value={searchTerm} onChange={setSearchTerm} />
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredArtists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Artists;
