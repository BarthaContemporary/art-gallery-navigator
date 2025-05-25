
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";

type RepresentationStatus = "all" | "represented" | "formerly represented" | "not represented";

interface RepresentationStatusFilterProps {
  value: RepresentationStatus;
  onChange: (value: RepresentationStatus) => void;
}

const statusOptions: { value: RepresentationStatus; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "represented", label: "Represented" },
  { value: "formerly represented", label: "Formerly Represented" },
  { value: "not represented", label: "Not Represented" },
];

export function RepresentationStatusFilter({ value, onChange }: RepresentationStatusFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <Filter className="h-5 w-5 text-muted-foreground" />
      <Select value={value} onValueChange={(newValue) => onChange(newValue as RepresentationStatus)}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
