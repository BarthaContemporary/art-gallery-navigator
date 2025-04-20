
import { Check, Clock, DollarSign, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Artwork } from "@/hooks/use-artworks";

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
  return (
    <Card>
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
          <img
            src={artwork.image_url || "/placeholder.svg"}
            alt={artwork.title}
            className="w-full h-auto"
          />
        </DialogContent>
      </Dialog>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg">{artwork.title}</h3>
            {artwork.year && <p className="text-sm">Year: {artwork.year}</p>}
            {artwork.medium && (
              <p className="text-xs text-muted-foreground mt-1">{artwork.medium}</p>
            )}
            {artwork.dimensions && (
              <p className="text-xs text-muted-foreground">{artwork.dimensions}</p>
            )}
          </div>
          <div className="flex flex-col items-end">
            {artwork.price && (
              <p className="font-medium">${artwork.price.toLocaleString()}</p>
            )}
            {artwork.status && (
              <div className="flex items-center mt-1">
                {statusIcons[artwork.status as keyof typeof statusIcons]}
                <span className="text-xs ml-1 capitalize">{artwork.status}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
