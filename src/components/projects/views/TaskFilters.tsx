import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useProjectTags, ProjectTag } from "@/hooks/projects/use-project-tags";
import { useProjectMembers } from "@/hooks/projects/use-project-members";
import { Search, Filter, X, SlidersHorizontal } from "lucide-react";

export interface TaskFiltersState {
  search: string;
  status: string;
  priority: string;
  assignee: string;
  tag: string;
}

interface TaskFiltersProps {
  projectId: string;
  filters: TaskFiltersState;
  onFiltersChange: (filters: TaskFiltersState) => void;
}

const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'abandoned', label: 'Abandoned' },
];

const PRIORITIES = [
  { value: 'all', label: 'All Priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function TaskFilters({ projectId, filters, onFiltersChange }: TaskFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: tags } = useProjectTags(projectId);
  const { members } = useProjectMembers(projectId);
  
  const activeFilterCount = [
    filters.status !== 'all',
    filters.priority !== 'all',
    filters.assignee !== 'all',
    filters.tag !== 'all',
  ].filter(Boolean).length;
  
  const handleChange = (key: keyof TaskFiltersState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };
  
  const handleReset = () => {
    onFiltersChange({
      search: '',
      status: 'all',
      priority: 'all',
      assignee: 'all',
      tag: 'all',
    });
  };
  
  return (
    <div className="flex items-center gap-2">
      {/* Search input */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={filters.search}
          onChange={(e) => handleChange('search', e.target.value)}
          className="pl-9 h-9"
        />
        {filters.search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
            onClick={() => handleChange('search', '')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      
      {/* Status filter */}
      <Select value={filters.status} onValueChange={(v) => handleChange('status', v)}>
        <SelectTrigger className="w-32 h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map(s => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* More filters popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="h-5 w-5 bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-4" align="end">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <Select value={filters.priority} onValueChange={(v) => handleChange('priority', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Assignee</label>
              <Select value={filters.assignee} onValueChange={(v) => handleChange('assignee', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members?.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.profile?.display_name || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {tags && tags.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Tag</label>
                <Select value={filters.tag} onValueChange={(v) => handleChange('tag', v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {tags.map((t: ProjectTag) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2" style={{ backgroundColor: t.color || '#6B7280' }} />
                          {t.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleReset}
            >
              Reset Filters
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const defaultFilters: TaskFiltersState = {
  search: '',
  status: 'all',
  priority: 'all',
  assignee: 'all',
  tag: 'all',
};
