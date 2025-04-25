
import { Filter, Image, FileText, Video, Book, Music } from "lucide-react";
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
  { label: "Painting", icon: <Image className="mr-2 h-4 w-4 text-blue-500" /> },
  { label: "Sculpture", icon: <FileText className="mr-2 h-4 w-4 text-orange-500" /> },
  { label: "Photography", icon: <Image className="mr-2 h-4 w-4 text-green-500" /> },
  { label: "Work on Paper", icon: <FileText className="mr-2 h-4 w-4 text-amber-500" /> },
  { label: "Installation", icon: <FileText className="mr-2 h-4 w-4 text-purple-500" /> },
  { label: "Video", icon: <Video className="mr-2 h-4 w-4 text-red-500" /> },
  { label: "Textile Arts", icon: <FileText className="mr-2 h-4 w-4 text-pink-500" /> },
  { label: "Book", icon: <Book className="mr-2 h-4 w-4 text-gray-500" /> },
] as const;

export function TypeFilter({ value, onChange }: TypeFilterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          {value ? `Type: ${value}` : "Filter by type"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onChange(null)}>
            <Filter className="mr-2 h-4 w-4 text-gray-500" /> All Types
          </DropdownMenuItem>
          {ARTWORK_TYPES.map((type) => (
            <DropdownMenuItem
              key={type.label}
              onClick={() => onChange(type.label)}
            >
              {type.icon} {type.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
