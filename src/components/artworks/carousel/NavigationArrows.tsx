
import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationArrowsProps {
  hasMultipleImages: boolean;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  onScrollPrev: () => void;
  onScrollNext: () => void;
}

export function NavigationArrows({
  hasMultipleImages,
  canScrollPrev,
  canScrollNext,
  onScrollPrev,
  onScrollNext,
}: NavigationArrowsProps) {
  if (!hasMultipleImages) return null;

  return (
    <>
      <Button
        variant="secondary"
        size="icon"
        className={cn(
          "absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 hover:bg-black/60 text-white border-none backdrop-blur-sm",
          !canScrollPrev && "opacity-30 cursor-not-allowed"
        )}
        onClick={onScrollPrev}
        disabled={!canScrollPrev}
      >
        <ChevronLeft className="w-5 h-5" />
      </Button>
      
      <Button
        variant="secondary"
        size="icon"
        className={cn(
          "absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 hover:bg-black/60 text-white border-none backdrop-blur-sm",
          !canScrollNext && "opacity-30 cursor-not-allowed"
        )}
        onClick={onScrollNext}
        disabled={!canScrollNext}
      >
        <ChevronRight className="w-5 h-5" />
      </Button>
    </>
  );
}
