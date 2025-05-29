
import { Filter, CheckCircle, XCircle, Clock, AlertTriangle, Hammer, HelpCircle, Shield } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StatusFilterProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

const statusOptions = [
  { value: "all", label: "All Status", icon: Filter },
  { value: "available", label: "Available", icon: CheckCircle },
  { value: "sold", label: "Sold", icon: XCircle },
  { value: "on loan", label: "On Loan", icon: Clock },
  { value: "on hold", label: "On Hold", icon: AlertTriangle },
  { value: "damaged", label: "Damaged", icon: Hammer },
  { value: "lost", label: "Lost", icon: HelpCircle },
  { value: "stolen", label: "Stolen", icon: Shield },
];

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <Select
      value={value || "all"}
      onValueChange={(newValue) => onChange(newValue === "all" ? null : newValue)}
    >
      <SelectTrigger className="w-full h-8 md:h-10 text-xs md:text-sm">
        <Filter className="mr-1.5 md:mr-2 h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
        <SelectValue placeholder="Filter Status" />
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((option) => {
          const IconComponent = option.icon;
          return (
            <SelectItem key={option.value} value={option.value} className="text-xs md:text-sm">
              <div className="flex items-center">
                <IconComponent className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                {option.label}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
