
import { Filter } from "lucide-react";
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
  { value: "painting", label: "Painting" },
  { value: "sculpture", label: "Sculpture" },
  { value: "print", label: "Print" },
  { value: "photograph", label: "Photograph" },
  { value: "drawing", label: "Drawing" },
  { value: "mixed media", label: "Mixed Media" },
  { value: "digital", label: "Digital" },
  { value: "installation", label: "Installation" },
  { value: "video", label: "Video" },
  { value: "performance", label: "Performance" },
  { value: "textile", label: "Textile" },
  { value: "ceramic", label: "Ceramic" },
  { value: "other", label: "Other" },
];

export function TypeFilter({ value, onChange }: TypeFilterProps) {
  return (
    <Select
      value={value || "all"}
      onValueChange={(newValue) => onChange(newValue === "all" ? null : newValue)}
    >
      <SelectTrigger className="w-full h-8 md:h-10 text-xs md:text-sm">
        <Filter className="mr-1.5 md:mr-2 h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
        <SelectValue placeholder="Filter Type" />
      </SelectTrigger>
      <SelectContent>
        {typeOptions.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-xs md:text-sm">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
