
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import JSZip from "jszip";
import { toast } from "sonner";

interface CarouselImageProps {
  imageUrl: string | null;
  index: number;
  totalImages: number;
  artistName: string;
  artworkTitle: string;
}

export function CarouselImage({ 
  imageUrl, 
  index,
  totalImages,
  artistName,
  artworkTitle,
}: CarouselImageProps) {
  const formatFileName = (artistName: string, artworkTitle: string) => {
    return `B_c-${artistName}-${artworkTitle}`.replace(/[^a-zA-Z0-9-_]/g, '_');
  };

  const handleDownload = async () => {
    try {
      if (!imageUrl) return;
      
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const zip = new JSZip();
      const baseFileName = formatFileName(artistName, artworkTitle);
      
      zip.file(`${baseFileName}_${index + 1}-${totalImages}.jpg`, blob);
      
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${baseFileName}_${index + 1}-${totalImages}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      toast.success("Image downloaded successfully");
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error("Failed to download image");
    }
  };

  return (
    <div className="flex-[0_0_100%] min-w-0 group relative">
      <AspectRatio ratio={4/3} className="bg-secondary/20">
        <img
          src={imageUrl || "/placeholder.svg"}
          alt="Artwork image"
          className="w-full h-full object-contain"
        />
        {imageUrl && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
          >
            <Download className="h-4 w-4" />
            <span className="sr-only">Download image</span>
          </Button>
        )}
      </AspectRatio>
    </div>
  );
}
