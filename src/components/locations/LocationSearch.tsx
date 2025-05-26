
import { Input } from "@/components/ui/input";

interface LocationSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export function LocationSearch({ searchTerm, onSearchChange }: LocationSearchProps) {
  return (
    <div className="mb-6 md:mb-8 mt-4 md:mt-6">
      <div className="relative max-w-sm">
        {/* Search icon removed */}
        <Input
          type="search"
          placeholder="Search locations..."
          className="px-3 h-8 md:h-10 text-xs md:text-sm py-1 md:py-2" // Changed pl-7 to px-3
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
    </div>
  );
}
