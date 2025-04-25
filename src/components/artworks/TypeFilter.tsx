
import { ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TypeFilterProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

const ARTWORK_TYPES = [
  "Painting",
  "Sculpture",
  "Photography",
  "Work on Paper",
  "Installation",
  "Video",
  "Textile Arts",
  "Book",
] as const;

export function TypeFilter({ value, onChange }: TypeFilterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <ListFilter className="mr-2 h-4 w-4" />
          {value ? `Type: ${value}` : "Filter by type"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onChange(null)}>
            All Types
          </DropdownMenuItem>
          {ARTWORK_TYPES.map((type) => (
            <DropdownMenuItem
              key={type}
              onClick={() => onChange(type)}
            >
              {type}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
