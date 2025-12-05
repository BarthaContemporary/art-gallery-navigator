import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isWithinInterval, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskWithAssignee } from "@/hooks/projects";
import { cn } from "@/lib/utils";

interface CalendarViewProps {
  tasks: TaskWithAssignee[] | undefined;
  onTaskClick: (task: TaskWithAssignee) => void;
}

export function CalendarView({ tasks, onTaskClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Calculate padding days for the calendar grid
  const startDay = monthStart.getDay();
  const paddingDays = Array(startDay).fill(null);
  
  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskWithAssignee[]>();
    
    tasks?.forEach(task => {
      if (task.end_date) {
        const dateKey = format(parseISO(task.end_date), 'yyyy-MM-dd');
        const existing = map.get(dateKey) || [];
        existing.push(task);
        map.set(dateKey, existing);
      }
    });
    
    return map;
  }, [tasks]);
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'active': return 'bg-blue-500';
      case 'scheduled': return 'bg-yellow-500';
      case 'abandoned': return 'bg-gray-500';
      default: return 'bg-muted';
    }
  };
  
  const getPriorityBorder = (priority: string | null) => {
    switch (priority) {
      case 'critical': return 'border-l-2 border-red-500';
      case 'high': return 'border-l-2 border-orange-500';
      case 'medium': return 'border-l-2 border-yellow-500';
      default: return '';
    }
  };
  
  return (
    <div className="border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold">{format(currentDate, 'MMMM yyyy')}</h3>
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {/* Padding days */}
        {paddingDays.map((_, i) => (
          <div key={`pad-${i}`} className="min-h-24 p-1 border-r border-b border-border bg-muted/20" />
        ))}
        
        {/* Actual days */}
        {daysInMonth.map(day => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate.get(dateKey) || [];
          const isToday = isSameDay(day, new Date());
          
          return (
            <div
              key={dateKey}
              className={cn(
                "min-h-24 p-1 border-r border-b border-border",
                isToday && "bg-primary/5"
              )}
            >
              <div className={cn(
                "text-sm mb-1",
                isToday ? "font-bold text-primary" : "text-muted-foreground"
              )}>
                {format(day, 'd')}
              </div>
              
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map(task => (
                  <button
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    className={cn(
                      "w-full text-left text-xs p-1 truncate hover:opacity-80",
                      getStatusColor(task.status),
                      getPriorityBorder(task.priority),
                      "text-white"
                    )}
                  >
                    {task.name}
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    +{dayTasks.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
