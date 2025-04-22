
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { EditArtistDialog } from "./EditArtistDialog";

// Color theme constants for easy updates and CSS consistency
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
  };
}

// Badge color and label for artist's status
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

  // For admin overlay button
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
        className={
          [
            "relative group flex flex-col overflow-hidden cursor-pointer transition-shadow h-[340px] bg-white outline-none",
            "border border-[#EEE]",
            "hover:shadow-lg",
            "focus-within:ring-2 focus-within:ring-[#18465a]/50",
          ].join(" ")
        }
        aria-label={isAdmin ? `Edit ${artist.full_name}` : undefined}
        style={{ background: "#fff" }}
      >
        {/* Artist image */}
        <div className="relative w-full h-[168px] bg-[#F1F1F1] overflow-hidden flex items-center justify-center">
          <img
            src={
              artist.image_url ||
              "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&auto=format&fit=crop&q=60"
            }
            alt={artist.full_name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            draggable={false}
            loading="lazy"
          />
          {isAdmin && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 z-10 h-8 w-8 bg-white/80 border border-[#18465a] shadow hover:bg-[#18465a] hover:text-white text-[#18465a] transition"
              onClick={handleEditClick}
              tabIndex={0}
              style={{ boxShadow: "0 2px 10px 0 rgba(24,70,90,0.07)" }}
              aria-label={`Edit ${artist.full_name}`}
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
        {/* Card content */}
        <CardContent
          className="w-full flex-1 flex flex-col px-4 pt-4 pb-3.5"
        >
          <div className="flex items-start justify-between">
            {isAdmin ? (
              <button
                type="button"
                onClick={handleEditClick}
                className="text-base font-bold leading-tight underline text-[#18465a] hover:text-[#455118] transition-colors focus:outline-none"
                aria-label={`Edit ${artist.full_name}`}
                style={{
                  textDecorationThickness: 2,
                  textUnderlineOffset: 3,
                }}
              >
                {artist.full_name}
              </button>
            ) : (
              <h3
                className="font-bold text-base text-[#18465a] leading-tight"
                style={{ lineHeight: 1.3 }}
              >
                {artist.full_name}
              </h3>
            )}
            <span
              className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium border ${badge.color} border-[#EEE]`}
            >
              {badge.label}
            </span>
          </div>
          <div className="text-xs text-[#8E9196] mt-2">
            {artist.nationality}
            {artist.nationality && artist.birth_year ? ", " : ""}
            {artist.birth_year && (
              <span className="text-[#18465a] font-medium">
                b. {artist.birth_year}
              </span>
            )}
            {!artist.nationality && !artist.birth_year && <span>—</span>}
          </div>
          {artist.biography && (
            <p className="mt-2 text-xs text-[#555] leading-snug line-clamp-2">
              {artist.biography}
            </p>
          )}
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

