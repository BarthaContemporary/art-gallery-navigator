
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

// Mock data for artists
const mockArtists = [
  { id: 1, full_name: "Emma Johnson", birth_year: 1975, nationality: "Canadian", representation_status: "represented", image_url: "https://images.unsplash.com/photo-1506863530036-1efeddceb993?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" },
  { id: 2, full_name: "Michael Chen", birth_year: 1982, nationality: "Chinese-American", representation_status: "represented", image_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" },
  { id: 3, full_name: "Sophia Rodriguez", birth_year: 1990, nationality: "Mexican", representation_status: "represented", image_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" },
  { id: 4, full_name: "David Kim", birth_year: 1978, nationality: "Korean", representation_status: "formerly represented", image_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" },
  { id: 5, full_name: "Amara Okafor", birth_year: 1986, nationality: "Nigerian", representation_status: "represented", image_url: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" },
  { id: 6, full_name: "Jean-Pierre Dubois", birth_year: 1965, nationality: "French", representation_status: "not represented", image_url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" },
];

const Artists = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const filteredArtists = mockArtists.filter(artist => 
    artist.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    artist.nationality.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredArtists.map((artist) => (
          <Card key={artist.id} className="overflow-hidden">
            <div className="aspect-[3/2] w-full overflow-hidden">
              <img
                src={artist.image_url}
                alt={artist.full_name}
                className="h-full w-full object-cover transition-all hover:scale-105"
              />
            </div>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{artist.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{artist.nationality}, b. {artist.birth_year}</p>
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
    </div>
  );
};

export default Artists;
