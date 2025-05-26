
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative flex-1 max-w-sm">
      {/* Search icon removed */}
      <Input
        type="search"
        placeholder="Search artworks..."
        className="pl-3 pr-3 h-8 md:h-10 text-xs md:text-sm py-1 md:py-2" // Changed pl-7 to pl-3
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
