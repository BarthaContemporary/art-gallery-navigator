
import { Check, Clock, DollarSign, Briefcase, Edit } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Artwork } from "@/hooks/use-artworks";
import { useAuth } from "@/hooks/use-auth";

interface ArtworkCardProps {
  artwork: Artwork;
}

const statusIcons = {
  available: <Check className="h-4 w-4 text-green-500" />,
  "on hold": <Clock className="h-4 w-4 text-amber-500" />,
  sold: <DollarSign className="h-4 w-4 text-blue-500" />,
  consigned: <Briefcase className="h-4 w-4 text-purple-500" />,
  "not for sale": <Check className="h-4 w-4 text-gray-500" />,
};

export function ArtworkCard({ artwork }: ArtworkCardProps) {
  const { isAdmin } = useAuth();

  return (
    <Card className="group relative">
      <Dialog>
        <DialogTrigger asChild>
          <div className="aspect-[4/3] w-full overflow-hidden cursor-pointer">
            <img
              src={artwork.image_url || "/placeholder.svg"}
              alt={artwork.title}
              className="h-full w-full object-cover transition-all hover:scale-105"
            />
          </div>
        </DialogTrigger>
        <DialogContent className="max-w-4xl">
          <div className="relative">
            <img
              src={artwork.image_url || "/placeholder.svg"}
              alt={artwork.title}
              className="w-full h-auto"
            />
          </div>
        </DialogContent>
      </Dialog>
      {isAdmin && (
        <Button 
          size="icon" 
          variant="ghost" 
          className="absolute top-2 right-2 h-8 w-8 bg-white/80 hover:bg-white shadow-sm" // Added shadow-sm for better visibility
        >
          <Edit className="h-4 w-4" />
          <span className="sr-only">Edit {artwork.title}</span>
        </Button>
      )}
      <CardContent className="p-4">
        <ScrollArea className="h-[200px] pr-4">
          <div className="flex flex-col space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{artwork.title}</h3>
                {artwork.year && <p className="text-sm">Year: {artwork.year}</p>}
                {artwork.materials && (
                  <p className="text-xs text-muted-foreground mt-1">{artwork.materials}</p>
                )}
                {artwork.dimensions && (
                  <p className="text-xs text-muted-foreground">{artwork.dimensions}</p>
                )}
                {artwork.medium_type && (
                  <p className="text-xs text-muted-foreground">Medium: {artwork.medium_type}</p>
                )}
              </div>
              <div className="flex flex-col items-end">
                {artwork.price && (
                  <p className="font-medium">
                    {artwork.currency} {artwork.price.toLocaleString()}
                  </p>
                )}
                {artwork.status && (
                  <div className="flex items-center mt-1">
                    {statusIcons[artwork.status as keyof typeof statusIcons]}
                    <span className="text-xs ml-1 capitalize">{artwork.status}</span>
                  </div>
                )}
              </div>
            </div>

            {artwork.classification !== 'Unique' && (
              <div className="border-t pt-3">
                <h4 className="text-sm font-medium mb-2">Edition Details</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p>Edition Size: {artwork.edition_size || 'N/A'}</p>
                  <p>Available: {artwork.available_works || 0}</p>
                  <p>Inventory: {artwork.inventory_quantity || 0}</p>
                  <p>Artist Proofs: {artwork.artist_proofs || 0}</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
