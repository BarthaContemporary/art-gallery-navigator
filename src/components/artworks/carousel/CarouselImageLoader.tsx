
interface CarouselImageLoaderProps {
  imageId: string;
  imageUrl: string;
  altText: string;
  isZoomed: boolean;
  isLoading: boolean;
  hasError: boolean;
  onLoadStart: () => void;
  onLoad: () => void;
  onError: () => void;
  onToggleZoom: () => void;
}

export function CarouselImageLoader({
  imageId,
  imageUrl,
  altText,
  isZoomed,
  isLoading,
  hasError,
  onLoadStart,
  onLoad,
  onError,
  onToggleZoom,
}: CarouselImageLoaderProps) {
  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted/20 z-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <p className="text-muted-foreground">Failed to load image</p>
          <p className="text-xs text-muted-foreground mt-1">ID: {imageId}</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={altText}
      className={`transition-all duration-300 ${
        isZoomed 
          ? 'w-auto h-auto min-w-full min-h-full object-contain cursor-zoom-out scale-150 origin-center' 
          : 'w-full h-full object-contain cursor-zoom-in hover:scale-105'
      }`}
      onLoadStart={onLoadStart}
      onLoad={onLoad}
      onError={onError}
      loading="lazy"
      onClick={onToggleZoom}
    />
  );
}
