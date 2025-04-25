
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface LocationSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export function LocationSearch({ searchTerm, onSearchChange }: LocationSearchProps) {
  return (
    <div className="mb-8 mt-6">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search locations..."
          className="pl-8"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
    </div>
  );
}
