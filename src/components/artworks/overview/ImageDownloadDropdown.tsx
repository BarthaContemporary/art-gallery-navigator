
import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Image, Loader2 } from "lucide-react";
import { useDownloadArtworkImages } from "@/hooks/use-download-artwork-images";
import { useLocalArtworkImages } from "@/hooks/use-local-artwork-images";

interface ImageDownloadDropdownProps {
  artworkId: string;
}

export function ImageDownloadDropdown({ artworkId }: ImageDownloadDropdownProps) {
  const { downloadAllImages, downloadSingleImage, isDownloading, hasImages } = useDownloadArtworkImages(artworkId);
  const { images } = useLocalArtworkImages(artworkId);

  if (!hasImages) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Image className="h-4 w-4" />
          )}
          Images
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={downloadAllImages} disabled={isDownloading}>
          <Download className="h-4 w-4 mr-2" />
          Download All ({images.length})
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {images.map((image, index) => (
          <DropdownMenuItem
            key={image.id}
            onClick={() => downloadSingleImage(image, index)}
            disabled={isDownloading}
            className="text-sm"
          >
            <Image className="h-3 w-3 mr-2" />
            Image {index + 1} {image.is_primary ? "(Primary)" : ""}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
