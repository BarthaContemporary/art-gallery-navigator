
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
    ? artist.representation_status
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "Unknown";

  // Badge color per status (soft green, yellow, or gray by status)
  const getBadgeColor = () => {
    if (!artist.representation_status) return "bg-[#F1F1F1] text-[#18465a]";
    if (artist.representation_status === "represented") {
      return "bg-[#F2FCE2] text-[#18465a]";
    } else if (artist.representation_status === "formerly represented") {
      return "bg-[#FEF7CD] text-[#18465a]";
    } else {
      return "bg-[#F1F1F1] text-[#18465a]";
    }
  };

  const handleCardClick = () => {
    if (isAdmin) {
      setEditOpen(true);
    }
  };

  return (
    <>
      <div
        data-testid="ArtistCard"
        className="w-full rounded-xl border bg-card shadow hover:shadow-md transition group flex flex-col overflow-hidden h-[340px] cursor-pointer focus-within:ring-2 focus-within:ring-[#18465a]/50"
        tabIndex={isAdmin ? 0 : -1}
        onClick={handleCardClick}
        aria-label={isAdmin ? `Edit ${artist.full_name}` : undefined}
        style={{ background: "#fff" }}
      >
        {/* Artist image */}
        <div className="relative w-full h-[168px] bg-[#F1F1F1] flex items-center justify-center overflow-hidden">
          <img
            src={
              artist.image_url ||
              "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&auto=format&fit=crop&q=60"
            }
            alt={artist.full_name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {isAdmin && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-3 right-3 z-10 rounded-full bg-white/80 hover:bg-[#18465a] hover:text-white text-[#18465a] p-2 border border-[#18465a] shadow"
              onClick={(e) => {
                e.stopPropagation();
                setEditOpen(true);
              }}
              style={{
                boxShadow: "0 2px 10px 0 rgba(24,70,90,0.06)",
              }}
            >
              <Edit className="h-5 w-5" />
            </Button>
          )}
        </div>
        {/* Card content */}
        <CardContent className="flex flex-col flex-1 justify-between p-4">
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between">
              <div>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditOpen(true);
                    }}
                    className="text-lg font-bold transition-colors underline text-[#18465a] hover:text-[#455118]/90 focus:outline-none"
                    aria-label={`Edit ${artist.full_name}`}
                    style={{ textDecorationThickness: "2px", textUnderlineOffset: "3px" }}
                  >
                    {artist.full_name}
                  </button>
                ) : (
                  <h3 className="font-bold text-lg text-[#18465a]">{artist.full_name}</h3>
                )}
              </div>
              <span
                className={`ml-2 text-xs px-2 py-1 rounded-full font-semibold transition ${getBadgeColor()}`}
              >
                {formattedStatus}
              </span>
            </div>
            <div className="text-sm text-muted-foreground text-[#8E9196] mt-1">
              <span>
                {artist.nationality}
                {artist.nationality && artist.birth_year ? ", " : ""}
                {artist.birth_year && (
                  <span className="text-[#18465a] font-medium">b. {artist.birth_year}</span>
                )}
                {!artist.nationality && !artist.birth_year && "—"}
              </span>
            </div>
            {artist.biography && (
              <p className="mt-2 text-xs line-clamp-2 text-[#555]">{artist.biography}</p>
            )}
          </div>
        </CardContent>
      </div>
      {isAdmin && (
        <EditArtistDialog artist={artist} open={editOpen} onOpenChange={setEditOpen} />
      )}
    </>
  );
};
