
import { useState, useCallback } from "react";
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

  const getOptimizedUrl = useCallback((url: string | null): string => {
    if (!url || url === 'null' || url === 'undefined') {
      return "/placeholder.svg";
    }

    // If already a Cloudinary URL, use it with artist-specific optimizations
    if (url.includes('res.cloudinary.com')) {
      try {
        const urlParts = url.split('/upload/');
        if (urlParts.length === 2 && urlParts[1] && urlParts[1] !== 'undefined') {
          const baseUrl = urlParts[0];
          const imagePath = urlParts[1];
          return `${baseUrl}/upload/w_400,h_300,c_fill,q_85,f_webp/${imagePath}`;
        }
      } catch (error) {
        console.warn(`Failed to optimize Cloudinary URL: ${url}`, error);
        return url;
      }
    }

    // For Supabase storage URLs
    if (url.includes('supabase.co/storage') && url.includes('/public/')) {
      const transformParams = "w=400&h=300&resize=cover&q=85&f=auto";
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}transform=${transformParams}`;
    }

    return url;
  }, []);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const optimizedUrl = getOptimizedUrl(imageUrl);

  return (
    <div 
      className={`aspect-[4/3] w-full overflow-hidden cursor-pointer relative bg-muted/30 ${className}`}
      onClick={onClick}
    >
      {/* Loading state */}
      {isLoading && (
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
      {!hasError && (
        <img
          src={optimizedUrl}
          alt={artistName}
          className={`h-full w-full object-cover transition-all hover:scale-105 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          loading="lazy"
        />
      )}
    </div>
  );
}
