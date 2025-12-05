import { Button } from "@/components/ui/button";
import { LayoutGrid, List, Calendar, GanttChart } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectView = 'board' | 'list' | 'calendar' | 'timeline';

interface ViewSwitcherProps {
  view: ProjectView;
  onViewChange: (view: ProjectView) => void;
}

const views: Array<{ id: ProjectView; label: string; icon: typeof LayoutGrid }> = [
  { id: 'board', label: 'Board', icon: LayoutGrid },
  { id: 'list', label: 'List', icon: List },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'timeline', label: 'Timeline', icon: GanttChart },
];

export function ViewSwitcher({ view, onViewChange }: ViewSwitcherProps) {
  return (
    <div className="flex items-center border border-border">
      {views.map(({ id, label, icon: Icon }) => (
        <Button
          key={id}
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 px-3 gap-1.5 border-0",
            view === id && "bg-muted"
          )}
          onClick={() => onViewChange(id)}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      ))}
    </div>
  );
}
