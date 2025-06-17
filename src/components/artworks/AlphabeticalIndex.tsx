
import React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface AlphabeticalIndexProps {
  letters: string[];
  onLetterClick: (letter: string) => void;
  activeLetter?: string;
}

export function AlphabeticalIndex({ letters, onLetterClick, activeLetter }: AlphabeticalIndexProps) {
  return (
    <div className="mb-6">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex items-center gap-2 pb-2">
          {letters.map((letter) => (
            <Button
              key={letter}
              variant={activeLetter === letter ? "default" : "outline"}
              className="w-8 h-8 p-0 flex-shrink-0"
              onClick={() => onLetterClick(letter)}
            >
              {letter}
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
