
import { useState } from "react";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { EditArtistDialog } from "./EditArtistDialog";

interface ArtistCardProps {
  artist: {
    id: string;
    full_name: string;
    birth_year: number | null;
    nationality: string | null;
    representation_status: string | null;
    biography: string | null;
    image_url: string | null;
  };
}

export const ArtistCard = ({ artist }: ArtistCardProps) => {
  const { isAdmin } = useAuth();
  const [editOpen, setEditOpen] = useState(false);

  const formattedStatus = artist.representation_status
    ? artist.representation_status.split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
    : "Unknown";

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

  const handleCardClick = () => {
    if (isAdmin) {
      setEditOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        className="w-full text-left group relative rounded-lg overflow-hidden shadow-sm transition border bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 h-[400px] flex flex-col" // Adjusted height from 500px to 400px
        onClick={handleCardClick}
        tabIndex={isAdmin ? 0 : -1}
        disabled={!isAdmin}
        aria-label={isAdmin ? `Edit ${artist.full_name}` : undefined}
      >
        <div className="aspect-[3/2] w-full overflow-hidden">
          <img
            src={artist.image_url || 'https://images.unsplash.com/photo-1506863530036-1efeddceb993?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'}
            alt={artist.full_name}
            className="h-full w-full object-cover transition-all group-hover:scale-105"
          />
        </div>
        {isAdmin && (
          <Button
            size="sm" // Changed from default to small size
            variant="ghost"
            className="absolute top-4 right-4 bg-white/80 hover:bg-white shadow-md z-10" 
            onClick={e => {
              e.stopPropagation();
              setEditOpen(true);
            }}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
        <CardContent className="p-4 mt-auto flex-grow flex flex-col justify-end"> 
          <div className="flex items-start justify-between">
            <div>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setEditOpen(true);
                  }}
                  className="font-semibold text-lg text-primary underline focus:outline-none hover:text-primary/80" // Slightly reduced text size
                  aria-label={`Edit ${artist.full_name}`}
                >
                  {artist.full_name}
                </button>
              ) : (
                <h3 className="font-semibold text-lg">{artist.full_name}</h3>
              )}
              <p className="text-sm text-muted-foreground"> {/* Reduced text size */}
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
      </button>
      {isAdmin && (
        <EditArtistDialog artist={artist} open={editOpen} onOpenChange={setEditOpen} />
      )}
    </>
  );
};

