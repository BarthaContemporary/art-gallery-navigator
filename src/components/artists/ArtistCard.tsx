
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { EditArtistDialog } from "./EditArtistDialog";

const statusIcons = {
  represented: <Check className="h-4 w-4 text-green-500" />,
  "formerly represented": <Clock className="h-4 w-4 text-amber-500" />,
};

export function ArtistCard({ artist }: { artist: any }) {
  const { isAdmin } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditDialogOpen(true);
  };

  const handleCardClick = () => {
    if (isAdmin) {
      setEditDialogOpen(true);
    }
  };

  return (
    <Card className="group relative">
      {isAdmin && (
        <Button 
          size="icon" 
          variant="ghost" 
          className="absolute top-2 right-2 h-8 w-8 bg-white/80 hover:bg-white shadow-sm z-10"
          onClick={(e) => {
            e.stopPropagation();
            handleEdit(e);
          }}
        >
          <Edit className="h-4 w-4" />
          <span className="sr-only">Actions for {artist.full_name}</span>
        </Button>
      )}
      
      <div 
        className="aspect-[4/3] w-full overflow-hidden cursor-pointer"
        onClick={handleCardClick}
      >
        <img
          src={artist.image_url || "/placeholder.svg"}
          alt={artist.full_name}
          className="h-full w-full object-cover transition-all hover:scale-105"
        />
      </div>
      
      <CardContent 
        className="p-4 cursor-pointer space-y-1"
        onClick={handleCardClick}
      >
        <h3 className="font-medium text-lg leading-tight">{artist.full_name}</h3>
        <p className="text-muted-foreground">
          {artist.nationality}
          {artist.nationality && artist.birth_year ? ", " : ""}
          {artist.birth_year && <span className="font-medium">b. {artist.birth_year}</span>}
        </p>
        
        {artist.email && (
          <p className="text-sm">
            <span className="text-muted-foreground">Email: </span>
            <a
              href={`mailto:${artist.email}`}
              className="underline hover:text-primary transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {artist.email}
            </a>
          </p>
        )}

        {artist.representation_status && (
          <div className="flex items-center mt-2">
            {statusIcons[artist.representation_status as keyof typeof statusIcons] || null}
            <span className="text-sm ml-1 capitalize">{artist.representation_status}</span>
          </div>
        )}
      </CardContent>
      
      <EditArtistDialog
        artist={artist}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </Card>
  );
}
