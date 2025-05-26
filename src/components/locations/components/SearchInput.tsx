
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchInputProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export function SearchInput({ searchTerm, onSearchChange }: SearchInputProps) {
  return (
    <div className="mb-6 md:mb-8 mt-4 md:mt-6">
      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1.5 md:top-2.5 h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search locations..."
          className="pl-7"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
    </div>
  );
}
