
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { EditArtistDialog } from "./EditArtistDialog";

const ARTIST_COLOR = "#18465a";
const LINK_COLOR = "#910000";
const HOVER_COLOR = "#455118";
const BG_GRAY = "#F1F1F1";

interface ArtistCardProps {
  artist: {
    id: string;
    full_name: string;
    birth_year: number | null;
    nationality: string | null;
    representation_status: string | null;
    biography: string | null;
    image_url: string | null;
    email?: string | null;
  };
}

function getBadgeProps(status: string | null) {
  if (!status)
    return {
      color: "bg-[#F1F1F1] text-[#18465a]",
      label: "Unknown",
    };
  if (status === "represented")
    return {
      color: "bg-[#F2FCE2] text-[#18465a]",
      label: "Represented",
    };
  if (status === "formerly represented")
    return {
      color: "bg-[#FEF7CD] text-[#18465a]",
      label: "Formerly Represented",
    };
  return {
    color: "bg-[#F1F1F1] text-[#18465a]",
    label: status
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
  };
}

export const ArtistCard = ({ artist }: ArtistCardProps) => {
  const { isAdmin } = useAuth();
  const [editOpen, setEditOpen] = useState(false);

  const badge = getBadgeProps(artist.representation_status);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditOpen(true);
  };

  return (
    <>
      <Card
        data-testid="ArtistCard"
        onClick={isAdmin ? () => setEditOpen(true) : undefined}
        tabIndex={isAdmin ? 0 : -1}
        className="group relative cursor-pointer transition-all"
        aria-label={isAdmin ? `Edit ${artist.full_name}` : undefined}
      >
        {isAdmin && (
          <Button 
            size="icon" 
            variant="ghost" 
            className="absolute top-2 right-2 h-8 w-8 bg-white/80 hover:bg-white shadow-sm z-10"
            onClick={handleEditClick}
          >
            <Edit className="h-4 w-4" />
            <span className="sr-only">Edit {artist.full_name}</span>
          </Button>
        )}
        
        <div 
          className="aspect-[4/3] w-full overflow-hidden"
        >
          <img
            src={artist.image_url || "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&auto=format&fit=crop&q=60"}
            alt={artist.full_name}
            className="h-full w-full object-cover transition-all hover:scale-105"
            draggable={false}
            loading="lazy"
          />
        </div>
        
        <CardContent className="p-4 space-y-1">
          <h3 className="font-medium text-lg leading-tight text-[#18465a]">
            {artist.full_name}
          </h3>
          
          <div className="text-xs text-muted-foreground">
            {artist.nationality}
            {artist.nationality && artist.birth_year ? ", " : ""}
            {artist.birth_year && (
              <span className="text-[#18465a] font-medium">
                b. {artist.birth_year}
              </span>
            )}
            {!artist.nationality && !artist.birth_year && <span>—</span>}
          </div>

          {artist.email && (
            <div className="text-xs text-[#910000] mt-1 break-all" title={artist.email}>
              <span className="font-medium">Email: </span>
              <a
                href={`mailto:${artist.email}`}
                className="underline hover:text-[#18465a] transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {artist.email}
              </a>
            </div>
          )}

          {artist.biography && (
            <p className="mt-2 text-xs text-[#555] leading-snug line-clamp-2">
              {artist.biography}
            </p>
          )}

          <div className="mt-auto pt-2 w-full">
            <span className={`w-full inline-block text-center text-xs px-2 py-0.5 rounded-full font-medium border ${badge.color} border-[#EEE]`}>
              {badge.label}
            </span>
          </div>
        </CardContent>
      </Card>
      
      {isAdmin && (
        <EditArtistDialog
          artist={artist}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </>
  );
};
