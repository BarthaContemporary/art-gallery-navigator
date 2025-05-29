
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProjectsSearchProps {
  search: string;
  status: string;
  type: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onTypeChange: (value: string) => void;
}

export function ProjectsSearch({
  search,
  status,
  type,
  onSearchChange,
  onStatusChange,
  onTypeChange,
}: ProjectsSearchProps) {
  return (
    <div className="grid grid-cols-1 gap-3 mb-4 md:grid-cols-3 md:gap-4 md:mb-6">
      <Input
        placeholder="Search projects..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="px-3 h-8 md:h-10 text-xs md:text-sm py-1 md:py-2"
      />

      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="h-8 md:h-10 text-xs md:text-sm">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="scheduled">Scheduled</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="abandoned">Abandoned</SelectItem>
        </SelectContent>
      </Select>

      <Select value={type} onValueChange={onTypeChange}>
        <SelectTrigger className="h-8 md:h-10 text-xs md:text-sm">
          <SelectValue placeholder="Filter by type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="exhibition">Exhibition</SelectItem>
          <SelectItem value="fair">Fair</SelectItem>
          <SelectItem value="publication">Publication</SelectItem>
          <SelectItem value="talk">Talk</SelectItem>
          <SelectItem value="other">Other</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
