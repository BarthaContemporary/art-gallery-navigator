
import { Check, Clock, DollarSign, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ArtworkCardProps {
  artwork: {
    id: number;
    title: string;
    artist: string;
    year: number;
    medium: string;
    dimensions: string;
    price: number;
    status: string;
    image_url: string;
  };
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
    <Card key={artwork.id} className="overflow-hidden">
      <div className="aspect-[4/3] w-full overflow-hidden">
        <img
          src={artwork.image_url}
          alt={artwork.title}
          className="h-full w-full object-cover transition-all hover:scale-105"
        />
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg">{artwork.title}</h3>
            <p className="text-sm">{artwork.artist}, {artwork.year}</p>
            <p className="text-xs text-muted-foreground mt-1">{artwork.medium}</p>
            <p className="text-xs text-muted-foreground">{artwork.dimensions}</p>
          </div>
          <div className="flex flex-col items-end">
            <p className="font-medium">${artwork.price.toLocaleString()}</p>
            <div className="flex items-center mt-1">
              {statusIcons[artwork.status as keyof typeof statusIcons]}
              <span className="text-xs ml-1 capitalize">{artwork.status}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
