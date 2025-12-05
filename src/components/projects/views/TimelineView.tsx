import { useMemo, useState } from "react";
import { format, differenceInDays, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isWithinInterval, parseISO, addWeeks, subWeeks, startOfDay, endOfDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskWithAssignee } from "@/hooks/projects";
import { cn } from "@/lib/utils";

interface TimelineViewProps {
  tasks: TaskWithAssignee[] | undefined;
  onTaskClick: (task: TaskWithAssignee) => void;
}

export function TimelineView({ tasks, onTaskClick }: TimelineViewProps) {
  const [startDate, setStartDate] = useState(() => startOfWeek(new Date()));
  const numWeeks = 4;
  const endDate = addWeeks(startDate, numWeeks);
  
  const days = eachDayOfInterval({ start: startDate, end: addDays(endDate, -1) });
  
  const sortedTasks = useMemo(() => {
    if (!tasks) return [];
    return [...tasks]
      .filter(t => t.start_date && t.end_date)
      .sort((a, b) => {
        const aStart = parseISO(a.start_date);
        const bStart = parseISO(b.start_date);
        return aStart.getTime() - bStart.getTime();
      });
  }, [tasks]);
  
  const getTaskPosition = (task: TaskWithAssignee) => {
    if (!task.start_date || !task.end_date) return null;
    
    const taskStart = parseISO(task.start_date);
    const taskEnd = parseISO(task.end_date);
    
    const totalDays = differenceInDays(endDate, startDate);
    const startOffset = Math.max(0, differenceInDays(taskStart, startDate));
    const endOffset = Math.min(totalDays, differenceInDays(taskEnd, startDate) + 1);
    const duration = endOffset - startOffset;
    
    if (duration <= 0 || startOffset >= totalDays) return null;
    
    return {
      left: `${(startOffset / totalDays) * 100}%`,
      width: `${(duration / totalDays) * 100}%`,
    };
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'active': return 'bg-blue-500';
      case 'scheduled': return 'bg-yellow-500';
      case 'abandoned': return 'bg-gray-400';
      default: return 'bg-muted';
    }
  };
  
  const getPriorityBorder = (priority: string | null) => {
    switch (priority) {
      case 'critical': return 'ring-2 ring-red-500';
      case 'high': return 'ring-2 ring-orange-500';
      default: return '';
    }
  };
  
  return (
    <div className="border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => setStartDate(subWeeks(startDate, 2))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold">
          {format(startDate, 'MMM d')} - {format(addDays(endDate, -1), 'MMM d, yyyy')}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => setStartDate(addWeeks(startDate, 2))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Timeline header with dates */}
      <div className="flex border-b border-border">
        <div className="w-48 min-w-[12rem] flex-shrink-0 p-2 border-r border-border bg-muted/50">
          <span className="text-sm font-medium">Task</span>
        </div>
        <div className="flex-1 flex">
          {days.map((day, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 min-w-[2rem] text-center py-2 text-xs border-r border-border last:border-r-0",
                day.getDay() === 0 || day.getDay() === 6 ? "bg-muted/30" : "",
                format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? "bg-primary/10" : ""
              )}
            >
              <div className="font-medium">{format(day, 'd')}</div>
              <div className="text-muted-foreground">{format(day, 'EEE')}</div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Task rows */}
      <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
        {sortedTasks.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No tasks with dates to display
          </div>
        ) : (
          sortedTasks.map(task => {
            const position = getTaskPosition(task);
            
            return (
              <div key={task.id} className="flex h-10 hover:bg-muted/30">
                <div className="w-48 min-w-[12rem] flex-shrink-0 px-2 py-1 border-r border-border flex items-center">
                  <button
                    onClick={() => onTaskClick(task)}
                    className="text-sm truncate text-left hover:text-primary"
                  >
                    {task.name}
                  </button>
                </div>
                <div className="flex-1 relative">
                  {position && (
                    <button
                      onClick={() => onTaskClick(task)}
                      className={cn(
                        "absolute top-1 h-8 text-white text-xs px-2 flex items-center truncate",
                        getStatusColor(task.status),
                        getPriorityBorder(task.priority),
                        "hover:opacity-90"
                      )}
                      style={position}
                    >
                      {task.name}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
