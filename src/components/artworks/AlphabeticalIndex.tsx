
import { Button } from "@/components/ui/button";

interface AlphabeticalIndexProps {
  letters: string[];
  onLetterClick: (letter: string) => void;
  activeLetter?: string;
}

export function AlphabeticalIndex({ letters, onLetterClick, activeLetter }: AlphabeticalIndexProps) {
  return (
    <div className="flex flex-wrap gap-1 mb-6">
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
    </div>
  );
}
