
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Plus, Calendar, Search, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";

// Mock data for exhibitions
const mockExhibitions = [
  { 
    id: 1, 
    title: "Modern Perspectives", 
    location: "Main Gallery", 
    start_date: "2025-05-15", 
    end_date: "2025-06-30", 
    artwork_count: 18,
    curator_notes: "Exploration of contemporary visual language across various media.",
    image_url: "https://images.unsplash.com/photo-1596742578443-7682ef7b7266?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
  },
  { 
    id: 2, 
    title: "Light & Form", 
    location: "East Wing", 
    start_date: "2025-07-10", 
    end_date: "2025-08-25", 
    artwork_count: 12,
    curator_notes: "Investigation of how light interacts with three-dimensional forms.",
    image_url: "https://images.unsplash.com/photo-1594656375376-560cb19a350d?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
  },
  { 
    id: 3, 
    title: "Urban Narratives", 
    location: "Project Space", 
    start_date: "2025-04-05", 
    end_date: "2025-04-28", 
    artwork_count: 8,
    curator_notes: "Stories of city life told through various artistic practices.",
    image_url: "https://images.unsplash.com/photo-1531243269054-3ac71bcdd0c5?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
  },
  { 
    id: 4, 
    title: "Nature Reimagined", 
    location: "Main Gallery", 
    start_date: "2025-09-15", 
    end_date: "2025-11-10", 
    artwork_count: 24,
    curator_notes: "Contemporary interpretations of natural landscapes and elements.",
    image_url: "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
  }
];

// Helper function to format dates
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Helper function to check if exhibition is current
const isCurrentExhibition = (startDate: string, endDate: string) => {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  return now >= start && now <= end;
};

const Exhibitions = () => {
  const [searchTerm, setSearchTerm] = useState("");
  
  const filteredExhibitions = mockExhibitions.filter(exhibition => 
    exhibition.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exhibition.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exhibitions</h1>
          <p className="text-muted-foreground">
            Plan and manage gallery exhibitions
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> New Exhibition
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search exhibitions..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredExhibitions.map((exhibition) => {
          const isCurrent = isCurrentExhibition(exhibition.start_date, exhibition.end_date);
          const isUpcoming = new Date(exhibition.start_date) > new Date();
          
          return (
            <Card key={exhibition.id} className="overflow-hidden">
              <div className="aspect-[16/9] w-full overflow-hidden relative">
                <img
                  src={exhibition.image_url}
                  alt={exhibition.title}
                  className="h-full w-full object-cover transition-all hover:scale-105"
                />
                {isCurrent && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                    Current
                  </div>
                )}
                {isUpcoming && (
                  <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                    Upcoming
                  </div>
                )}
              </div>
              <CardHeader className="pb-2">
                <h3 className="font-semibold text-lg">{exhibition.title}</h3>
              </CardHeader>
              <CardContent className="pb-4 pt-0">
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>{formatDate(exhibition.start_date)} - {formatDate(exhibition.end_date)}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>{exhibition.location}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{exhibition.curator_notes}</p>
                </div>
              </CardContent>
              <CardFooter className="pt-0 text-sm text-muted-foreground">
                {exhibition.artwork_count} artworks
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Exhibitions;
