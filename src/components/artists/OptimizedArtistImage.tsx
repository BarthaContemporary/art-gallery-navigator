
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
    console.log(`Processing image URL for ${artistName}:`, url);
    
    if (!url || url === 'null' || url === 'undefined' || url.trim() === '') {
      console.log(`No valid URL for ${artistName}, using placeholder`);
      return "/placeholder.svg";
    }

    // If already a Cloudinary URL, use it with artist-specific optimizations
    if (url.includes('res.cloudinary.com')) {
      try {
        const urlParts = url.split('/upload/');
        if (urlParts.length === 2 && urlParts[1] && urlParts[1] !== 'undefined') {
          const baseUrl = urlParts[0];
          const imagePath = urlParts[1];
          const optimizedUrl = `${baseUrl}/upload/w_400,h_300,c_fill,q_85,f_webp/${imagePath}`;
          console.log(`Optimized Cloudinary URL for ${artistName}:`, optimizedUrl);
          return optimizedUrl;
        }
      } catch (error) {
        console.warn(`Failed to optimize Cloudinary URL for ${artistName}:`, url, error);
        return url;
      }
    }

    // For Supabase storage URLs
    if (url.includes('supabase.co/storage') && url.includes('/public/')) {
      const transformParams = "w=400&h=300&resize=cover&q=85&f=auto";
      const separator = url.includes('?') ? '&' : '?';
      const optimizedUrl = `${url}${separator}transform=${transformParams}`;
      console.log(`Optimized Supabase URL for ${artistName}:`, optimizedUrl);
      return optimizedUrl;
    }

    console.log(`Using original URL for ${artistName}:`, url);
    return url;
  }, [artistName]);

  const handleImageLoad = useCallback(() => {
    console.log(`Image loaded successfully for ${artistName}`);
    setIsLoading(false);
    setHasError(false);
  }, [artistName]);

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const imgElement = e.target as HTMLImageElement;
    console.error(`Image failed to load for ${artistName}:`, imgElement.src);
    setIsLoading(false);
    setHasError(true);
  }, [artistName]);

  const optimizedUrl = getOptimizedUrl(imageUrl);

  // Always show placeholder if no valid URL
  if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined' || imageUrl.trim() === '') {
    return (
      <div 
        className={`aspect-[4/3] w-full overflow-hidden cursor-pointer relative bg-muted/30 flex items-center justify-center ${className}`}
        onClick={onClick}
      >
        <User className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

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
