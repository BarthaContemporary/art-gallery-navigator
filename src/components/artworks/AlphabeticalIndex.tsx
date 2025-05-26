
import React from "react";
import { Button } from "@/components/ui/button";
// Tooltip components and ArrowUp are no longer needed here
// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// import { ArrowUp } from "lucide-react";

interface AlphabeticalIndexProps {
  letters: string[];
  onLetterClick: (letter: string) => void;
  activeLetter?: string;
  // onScrollToTop prop is removed
}

export function AlphabeticalIndex({ letters, onLetterClick, activeLetter }: AlphabeticalIndexProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {letters.map((letter) => (
        <div key={letter} className="flex items-center">
          <Button
            variant={activeLetter === letter ? "default" : "outline"}
            className="w-8 h-8 p-0"
            onClick={() => onLetterClick(letter)}
          >
            {letter}
          </Button>
          {/* Scroll to top button removed from here */}
        </div>
      ))}
    </div>
  );
}
