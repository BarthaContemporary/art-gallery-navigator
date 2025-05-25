
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
    <Select value={value} onValueChange={(newValue) => onChange(newValue as RepresentationStatus)}>
      <SelectTrigger className="w-[220px]">
        <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
        <SelectValue placeholder="Filter Status" />
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
