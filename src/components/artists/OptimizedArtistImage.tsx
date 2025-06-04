
import { useState } from "react";
import { Loader2, User } from "lucide-react";

interface OptimizedArtistImageProps {
  imageUrl: string | null;
  artistName: string;
  onClick?: () => void;
  className?: string;
}

export function OptimizedArtistImage({ 
  imageUrl, 
  artistName, 
  onClick,
  className = ""
}: OptimizedArtistImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div 
      className={`aspect-[4/3] w-full overflow-hidden cursor-pointer relative bg-muted/30 ${className}`}
      onClick={onClick}
    >
      {/* Loading state */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
          <User className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      {/* Image */}
      <img
        src={imageUrl || "/placeholder.svg"}
        alt={artistName}
        className={`h-full w-full object-cover transition-all hover:scale-105 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
      />
    </div>
  );
}
