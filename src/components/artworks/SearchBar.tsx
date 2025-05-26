
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative flex-1 max-w-sm">
      <Search className="absolute left-2 top-1.5 md:top-2.5 h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search artworks..."
        className="pl-7"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
