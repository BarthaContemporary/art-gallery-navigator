
import { Filter, Palette, Hammer, Printer, Camera, PenTool, Layers, Monitor, Building, Video, Music, Shirt, CircleDot, MoreHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TypeFilterProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

const typeOptions = [
  { value: "all", label: "All Types" },
  { value: "painting", label: "Painting", icon: Palette },
  { value: "sculpture", label: "Sculpture", icon: Hammer },
  { value: "print", label: "Print", icon: Printer },
  { value: "photograph", label: "Photograph", icon: Camera },
  { value: "drawing", label: "Drawing", icon: PenTool },
  { value: "mixed media", label: "Mixed Media", icon: Layers },
  { value: "digital", label: "Digital", icon: Monitor },
  { value: "installation", label: "Installation", icon: Building },
  { value: "video", label: "Video", icon: Video },
  { value: "performance", label: "Performance", icon: Music },
  { value: "textile", label: "Textile", icon: Shirt },
  { value: "ceramic", label: "Ceramic", icon: CircleDot },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

export function TypeFilter({ value, onChange }: TypeFilterProps) {
  return (
    <Select
      value={value || "all"}
      onValueChange={(newValue) => onChange(newValue === "all" ? null : newValue)}
    >
      <SelectTrigger className="w-full h-5 text-xs px-1.5 gap-1">
        <Filter className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        <SelectValue placeholder="Filter Type" />
      </SelectTrigger>
      <SelectContent>
        {typeOptions.map((option) => {
          if (option.value === "all") {
            return (
              <SelectItem key={option.value} value={option.value} className="text-xs">
                {option.label}
              </SelectItem>
            );
          }
          const IconComponent = option.icon;
          return (
            <SelectItem key={option.value} value={option.value} className="text-xs">
              <div className="flex items-center">
                <IconComponent className="mr-2 h-3 w-3" />
                {option.label}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
