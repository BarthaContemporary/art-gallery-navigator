
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export const SearchBar = ({ value, onChange }: SearchBarProps) => {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 max-w-sm">
        {/* Search icon removed */}
        <Input
          type="search"
          placeholder="Search artists..."
          className="px-3 h-8 md:h-10 text-xs md:text-sm py-1 md:py-2" // Changed pl-7 to px-3
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
