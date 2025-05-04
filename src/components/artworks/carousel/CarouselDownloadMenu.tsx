
import { Download } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface CarouselDownloadMenuProps {
  images: {
    id: string;
    artwork_id: string;
    image_url: string;
    is_primary: boolean;
    display_order: number;
  }[];
  artistName: string;
  artworkTitle: string;
}

export function CarouselDownloadMenu({
  images,
  artistName,
  artworkTitle
}: CarouselDownloadMenuProps) {
  const formatFileName = (artistName: string, artworkTitle: string, index: number, total: number) => {
    return `B_c-${artistName}-${artworkTitle}_${index + 1}-${total}`.replace(/[^a-zA-Z0-9-_]/g, '_');
  };

  const handleDownload = (imageUrl: string, index: number) => {
    try {
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = `${formatFileName(artistName, artworkTitle, index, images.length)}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download image");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-1">
          <Download className="h-4 w-4" />
          Download
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {images.map((image, index) => (
          <DropdownMenuItem key={image.id} onClick={() => handleDownload(image.image_url, index)}>
            Image {index + 1} of {images.length}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
