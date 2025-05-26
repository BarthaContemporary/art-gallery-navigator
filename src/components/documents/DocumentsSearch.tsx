import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, FileText, FileImage, FileCheck, FileBox, FileClock, FileKey, FilePlus } from "lucide-react";
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
    <div className="mb-4 md:mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-2 md:gap-4">
      <div className="relative flex-1 w-full max-w-sm">
        <Input
          type="search"
          placeholder="Search documents..."
          className="px-3 h-8 md:h-10 text-xs md:text-sm py-1 md:py-2"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <Filter className="mr-1 h-3 w-3 md:mr-2 md:h-4 md:w-4" />
            <span className="text-xs md:text-sm truncate">
              {typeFilter ? `Type: ${typeFilter}` : "Filter by type"}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48 md:w-56">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onTypeFilterChange(null)}>
              <FileBox className="mr-2 h-3 w-3 md:h-4 md:w-4" />
              All Document Types
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTypeFilterChange("condition report")}>
              <FileCheck className="mr-2 h-3 w-3 md:h-4 md:w-4" />
              Condition Reports
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTypeFilterChange("invoice")}>
              <FileText className="mr-2 h-3 w-3 md:h-4 md:w-4" />
              Invoices
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTypeFilterChange("provenance")}>
              <FileKey className="mr-2 h-3 w-3 md:h-4 md:w-4" />
              Provenance Documents
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTypeFilterChange("CoA")}>
              <FileCheck className="mr-2 h-3 w-3 md:h-4 md:w-4" />
              Certificates of Authenticity
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTypeFilterChange("loan agreement")}>
              <FileText className="mr-2 h-3 w-3 md:h-4 md:w-4" />
              Loan Agreement
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTypeFilterChange("image zip")}>
              <FileImage className="mr-2 h-3 w-3 md:h-4 md:w-4" />
              Image ZIP
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTypeFilterChange("related file")}>
              <FilePlus className="mr-2 h-3 w-3 md:h-4 md:w-4" />
              Related File
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
