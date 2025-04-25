
import { AspectRatio } from "@/components/ui/aspect-ratio";

interface ArtworkCardImageProps {
  imageUrl: string | null;
  title: string;
  onClick: () => void;
}

export function ArtworkCardImage({ imageUrl, title, onClick }: ArtworkCardImageProps) {
  return (
    <div 
      className="aspect-[4/3] w-full overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      <AspectRatio ratio={4/3}>
        <img
          src={imageUrl || "/placeholder.svg"}
          alt={title}
          className="h-full w-full object-cover transition-all hover:scale-105"
        />
      </AspectRatio>
    </div>
  );
}
