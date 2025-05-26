
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUp } from "lucide-react";

interface AlphabeticalIndexProps {
  letters: string[];
  onLetterClick: (letter: string) => void;
  activeLetter?: string;
  onScrollToTop?: () => void; // New prop
}

export function AlphabeticalIndex({ letters, onLetterClick, activeLetter, onScrollToTop }: AlphabeticalIndexProps) {
  return (
    <div className="flex flex-wrap items-center gap-1 mb-6">
      {letters.map((letter) => (
        <Button
          key={letter}
          variant={activeLetter === letter ? "default" : "outline"}
          className="w-8 h-8 p-0"
          onClick={() => onLetterClick(letter)}
        >
          {letter}
        </Button>
      ))}
      {letters.length > 0 && onScrollToTop && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="w-8 h-8 ml-1" // Added ml-1 for a bit of spacing
                onClick={onScrollToTop}
                aria-label="Scroll to top"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Scroll to Top</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
