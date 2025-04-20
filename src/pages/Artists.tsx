
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Artists</h1>
          <p className="text-muted-foreground">
            Manage represented and non-represented artists
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Artist
        </Button>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search artists..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <Card key={n} className="animate-pulse">
              <div className="aspect-[3/2] w-full bg-muted"></div>
              <CardContent className="p-4">
                <div className="h-4 w-2/3 bg-muted rounded mb-2"></div>
                <div className="h-3 w-1/2 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArtists.map((artist) => (
            <Card key={artist.id} className="overflow-hidden">
              <div className="aspect-[3/2] w-full overflow-hidden">
                <img
                  src={artist.image_url || 'https://images.unsplash.com/photo-1506863530036-1efeddceb993?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'}
                  alt={artist.full_name}
                  className="h-full w-full object-cover transition-all hover:scale-105"
                />
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{artist.full_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {artist.nationality}, {artist.birth_year ? `b. ${artist.birth_year}` : 'Year unknown'}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    artist.representation_status === "represented" 
                      ? "bg-green-100 text-green-800" 
                      : artist.representation_status === "formerly represented" 
                      ? "bg-amber-100 text-amber-800"
                      : "bg-gray-100 text-gray-800"
                  }`}>
                    {artist.representation_status.split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Artists;
