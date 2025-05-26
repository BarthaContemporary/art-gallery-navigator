
import React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUp } from "lucide-react";

interface AlphabeticalIndexProps {
  letters: string[];
  onLetterClick: (letter: string) => void;
  activeLetter?: string;
  onScrollToTop?: () => void;
}

export function AlphabeticalIndex({ letters, onLetterClick, activeLetter, onScrollToTop }: AlphabeticalIndexProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-6"> {/* Increased gap slightly for groups */}
      {letters.map((letter) => (
        <div key={letter} className="flex items-center"> {/* Group for letter + arrow */}
          <Button
            variant={activeLetter === letter ? "default" : "outline"}
            className="w-8 h-8 p-0"
            onClick={() => onLetterClick(letter)}
          >
            {letter}
          </Button>
          {onScrollToTop && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-8 h-8 p-0 ml-0.5 flex items-center justify-center" // Matched size, centered icon, small margin
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
      ))}
      {/* The single scroll-to-top button previously here has been removed,
          as this functionality is now available next to each letter. */}
    </div>
  );
}
