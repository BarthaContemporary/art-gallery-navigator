import { useState } from "react";
import { CreateArtworkDialog } from "@/components/artworks/CreateArtworkDialog";
import { SearchBar } from "@/components/artworks/SearchBar";
import { StatusFilter } from "@/components/artworks/StatusFilter";
import { ArtworkGrid } from "@/components/artworks/ArtworkGrid";

// Mock data for artworks
const mockArtworks = [
  { 
    id: 1, 
    title: "Abstract Composition #42", 
    artist: "Emma Johnson", 
    year: 2022, 
    medium: "Oil on canvas", 
    dimensions: "120 x 100 cm", 
    price: 8500, 
    status: "available", 
    image_url: "https://images.unsplash.com/photo-1615921511258-0aa98c84d400?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" 
  },
  { 
    id: 2, 
    title: "Summer Landscape", 
    artist: "Michael Chen", 
    year: 2021, 
    medium: "Acrylic on panel", 
    dimensions: "80 x 100 cm", 
    price: 6200, 
    status: "sold", 
    image_url: "https://images.unsplash.com/photo-1579541591970-e5be9d3d85c6?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" 
  },
  { 
    id: 3, 
    title: "Urban Perspective", 
    artist: "Sophia Rodriguez", 
    year: 2023, 
    medium: "Mixed media", 
    dimensions: "90 x 70 cm", 
    price: 5400, 
    status: "available", 
    image_url: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" 
  },
  { 
    id: 4, 
    title: "Blue Reflections", 
    artist: "David Kim", 
    year: 2020, 
    medium: "Oil on linen", 
    dimensions: "100 x 120 cm", 
    price: 7800, 
    status: "on hold", 
    image_url: "https://images.unsplash.com/photo-1549887534-1541e9326642?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" 
  },
  { 
    id: 5, 
    title: "Vibrant Dreams", 
    artist: "Amara Okafor", 
    year: 2023, 
    medium: "Acrylic on canvas", 
    dimensions: "150 x 120 cm", 
    price: 9200, 
    status: "available", 
    image_url: "https://images.unsplash.com/photo-1591280063444-d3c514eb6e13?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" 
  },
  { 
    id: 6, 
    title: "Memory Fragments", 
    artist: "Jean-Pierre Dubois", 
    year: 2019, 
    medium: "Oil and collage on canvas", 
    dimensions: "90 x 90 cm", 
    price: 7500, 
    status: "consigned", 
    image_url: "https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" 
  },
];

const Artworks = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  
  const filteredArtworks = mockArtworks.filter(artwork => {
    const matchesSearch = 
      artwork.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      artwork.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
      artwork.medium.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter ? artwork.status === statusFilter : true;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Artworks</h1>
          <p className="text-muted-foreground">
            Browse and manage your gallery inventory
          </p>
        </div>
        <CreateArtworkDialog />
      </div>

      <div className="mb-6 flex items-center gap-4">
        <SearchBar value={searchTerm} onChange={setSearchTerm} />
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      </div>

      <ArtworkGrid artworks={filteredArtworks} />
    </div>
  );
};

export default Artworks;
