
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Plus, 
  Search,
  Filter,
  Check,
  Clock,
  DollarSign, 
  Briefcase
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

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

const statusIcons = {
  available: <Check className="h-4 w-4 text-green-500" />,
  "on hold": <Clock className="h-4 w-4 text-amber-500" />,
  sold: <DollarSign className="h-4 w-4 text-blue-500" />,
  consigned: <Briefcase className="h-4 w-4 text-purple-500" />,
  "not for sale": <Check className="h-4 w-4 text-gray-500" />,
};

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
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Artwork
        </Button>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search artworks..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              {statusFilter ? `Status: ${statusFilter}` : "Filter by status"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                All Statuses
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("available")}>
                <Check className="mr-2 h-4 w-4 text-green-500" /> Available
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("on hold")}>
                <Clock className="mr-2 h-4 w-4 text-amber-500" /> On Hold
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("sold")}>
                <DollarSign className="mr-2 h-4 w-4 text-blue-500" /> Sold
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("consigned")}>
                <Briefcase className="mr-2 h-4 w-4 text-purple-500" /> Consigned
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("not for sale")}>
                <Check className="mr-2 h-4 w-4 text-gray-500" /> Not for Sale
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredArtworks.map((artwork) => (
          <Card key={artwork.id} className="overflow-hidden">
            <div className="aspect-[4/3] w-full overflow-hidden">
              <img
                src={artwork.image_url}
                alt={artwork.title}
                className="h-full w-full object-cover transition-all hover:scale-105"
              />
            </div>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{artwork.title}</h3>
                  <p className="text-sm">{artwork.artist}, {artwork.year}</p>
                  <p className="text-xs text-muted-foreground mt-1">{artwork.medium}</p>
                  <p className="text-xs text-muted-foreground">{artwork.dimensions}</p>
                </div>
                <div className="flex flex-col items-end">
                  <p className="font-medium">${artwork.price.toLocaleString()}</p>
                  <div className="flex items-center mt-1">
                    {statusIcons[artwork.status as keyof typeof statusIcons]}
                    <span className="text-xs ml-1 capitalize">{artwork.status}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Artworks;
