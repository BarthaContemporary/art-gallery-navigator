
import { Filter, Check, Clock, DollarSign, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StatusFilterProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          {value ? `Status: ${value}` : "Filter by status"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onChange(null)}>
            All Statuses
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onChange("available")}>
            <Check className="mr-2 h-4 w-4 text-green-500" /> Available
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onChange("on hold")}>
            <Clock className="mr-2 h-4 w-4 text-amber-500" /> On Hold
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onChange("sold")}>
            <DollarSign className="mr-2 h-4 w-4 text-blue-500" /> Sold
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onChange("consigned")}>
            <Briefcase className="mr-2 h-4 w-4 text-purple-500" /> Consigned
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onChange("not for sale")}>
            <Check className="mr-2 h-4 w-4 text-gray-500" /> Not for Sale
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
