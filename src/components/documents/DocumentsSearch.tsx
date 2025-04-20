
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DocumentsSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  typeFilter: string | null;
  onTypeFilterChange: (type: string | null) => void;
}

export function DocumentsSearch({
  searchTerm,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
}: DocumentsSearchProps) {
  return (
    <div className="mb-6 flex items-center gap-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search documents..."
          className="pl-8"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            {typeFilter ? `Type: ${typeFilter}` : "Filter by type"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onTypeFilterChange(null)}>
              All Document Types
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTypeFilterChange("condition report")}>
              Condition Reports
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTypeFilterChange("invoice")}>
              Invoices
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTypeFilterChange("provenance")}>
              Provenance Documents
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTypeFilterChange("CoA")}>
              Certificates of Authenticity
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
