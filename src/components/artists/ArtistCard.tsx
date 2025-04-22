
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface ArtistCardProps {
  artist: {
    id: string;
    full_name: string;
    birth_year: number | null;
    nationality: string | null;
    representation_status: string | null;
    image_url: string | null;
  };
}

export const ArtistCard = ({ artist }: ArtistCardProps) => {
  const { isAdmin } = useAuth();
  
  // Format the representation status safely
  const formattedStatus = artist.representation_status 
    ? artist.representation_status.split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
    : "Unknown";
  
  // Determine badge color based on status
  const getBadgeColor = () => {
    if (!artist.representation_status) return "bg-gray-100 text-gray-800";
    
    if (artist.representation_status === "represented") {
      return "bg-green-100 text-green-800";
    } else if (artist.representation_status === "formerly represented") {
      return "bg-amber-100 text-amber-800";
    } else {
      return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card key={artist.id} className="overflow-hidden group relative">
      <div className="aspect-[3/2] w-full overflow-hidden">
        <img
          src={artist.image_url || 'https://images.unsplash.com/photo-1506863530036-1efeddceb993?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'}
          alt={artist.full_name}
          className="h-full w-full object-cover transition-all hover:scale-105"
        />
      </div>
      {isAdmin && (
        <Button 
          size="icon" 
          variant="ghost" 
          className="absolute top-2 right-2 h-8 w-8 bg-white/80 hover:bg-white shadow-sm"
        >
          <Edit className="h-4 w-4" />
          <span className="sr-only">Edit {artist.full_name}</span>
        </Button>
      )}
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg">{artist.full_name}</h3>
            <p className="text-sm text-muted-foreground">
              {artist.nationality}, {artist.birth_year ? `b. ${artist.birth_year}` : 'Year unknown'}
            </p>
          </div>
          <div>
            <span className={`text-xs px-2 py-1 rounded-full ${getBadgeColor()}`}>
              {formattedStatus}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
