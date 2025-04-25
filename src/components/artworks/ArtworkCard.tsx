import { Check, Clock, DollarSign, Briefcase, Edit, ArrowDown, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Artwork } from "@/hooks/use-artworks";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { EditArtworkDialog } from "./EditArtworkDialog";
import { ArtworkOverviewDialog } from "./ArtworkOverviewDialog";
import { exportArtworksToCSV } from "@/lib/csv-utils";
import { useArtists } from "../artworks/form/useArtists";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ArtworkCardProps {
  artwork: Artwork;
}

const statusIcons = {
  available: <Check className="h-4 w-4 text-green-500" />,
  "on hold": <Clock className="h-4 w-4 text-amber-500" />,
  sold: <DollarSign className="h-4 w-4 text-blue-500" />,
  consigned: <Briefcase className="h-4 w-4 text-purple-500" />,
  "not for sale": <Check className="h-4 w-4 text-gray-500" />,
  returned: <ArrowDown className="h-4 w-4 text-black" />,
};

export function ArtworkCard({ artwork }: ArtworkCardProps) {
  const { isAdmin } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [overviewDialogOpen, setOverviewDialogOpen] = useState(false);
  const { data: artists } = useArtists();

  const handleEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditDialogOpen(true);
  };

  const handleCardClick = () => {
    setOverviewDialogOpen(true);
  };

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    exportArtworksToCSV([artwork], `artwork_${artwork.id}.csv`);
  };

  const getArtistName = () => {
    if (artwork.artist_id && artists) {
      const artist = artists.find(a => a.id === artwork.artist_id);
      return artist ? artist.full_name : "Unknown Artist";
    }
    return "Unknown Artist";
  };

  return (
    <Card className="group relative">
      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              size="icon" 
              variant="ghost" 
              className="absolute top-2 right-2 h-8 w-8 bg-white/80 hover:bg-white shadow-sm z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <Edit className="h-4 w-4" />
              <span className="sr-only">Actions for {artwork.title}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export as CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      
      <div 
        className="aspect-[4/3] w-full overflow-hidden cursor-pointer"
        onClick={handleCardClick}
      >
        <img
          src={artwork.image_url || "/placeholder.svg"}
          alt={artwork.title}
          className="h-full w-full object-cover transition-all hover:scale-105"
        />
      </div>
      
      <CardContent 
        className="p-4 cursor-pointer space-y-1"
        onClick={handleCardClick}
      >
        <h3 className="font-medium text-lg leading-tight">{artwork.title}</h3>
        <p className="text-muted-foreground">{getArtistName()}</p>
        <p className="text-sm">{artwork.medium_type}</p>
        {artwork.price && (
          <p className="font-medium">
            {artwork.currency} {artwork.price.toLocaleString()}
          </p>
        )}
        {artwork.status && (
          <div className="flex items-center">
            {statusIcons[artwork.status as keyof typeof statusIcons]}
            <span className="text-sm ml-1 capitalize">{artwork.status}</span>
          </div>
        )}
      </CardContent>
      
      <EditArtworkDialog
        artwork={artwork}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
      
      <ArtworkOverviewDialog
        artwork={artwork}
        open={overviewDialogOpen}
        onOpenChange={setOverviewDialogOpen}
      />
    </Card>
  );
}
