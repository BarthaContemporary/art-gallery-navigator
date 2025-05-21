
import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProjectWithLocation, TaskWithAssignee, useProjectTasks } from "@/hooks/projects";
import { format } from "date-fns";

interface ProjectCalendarViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectWithLocation | null;
  onTaskClick?: (task: TaskWithAssignee) => void; // Added prop for task click
}

export function ProjectCalendarView({ open, onOpenChange, project, onTaskClick }: ProjectCalendarViewProps) {
  const { data: tasks } = useProjectTasks(project?.id);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  if (!project) return null;
  
  // Format dates, ensuring they are valid
  const startDate = project.start_date ? new Date(project.start_date) : new Date();
  const endDate = project.end_date ? new Date(project.end_date) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // Default to 7 days if end_date is missing
  
  // Calculate how many days the project spans
  const projectDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  
  // Generate an array of dates for the calendar
  const dateArray = Array.from({ length: projectDays }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    return date;
  });
  
  const getTaskPosition = (task: TaskWithAssignee) => {
    const taskStart = task.start_date ? new Date(task.start_date) : startDate;
    const taskEnd = task.end_date ? new Date(task.end_date) : taskStart;
    
    // Calculate position as percentage from left edge (day index)
    const leftDays = Math.max(0, (taskStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate width (duration) as day count
    const widthDays = Math.max(1, Math.ceil((taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    
    return { left: leftDays, width: widthDays };
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'scheduled': return 'bg-blue-500';
      case 'completed': return 'bg-gray-500';
      case 'abandoned': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const handleTaskBarClick = (task: TaskWithAssignee) => {
    if (onTaskClick) {
      console.log("ProjectCalendarView: Task bar clicked", task);
      onTaskClick(task);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-screen overflow-auto">
        <DialogHeader>
          <DialogTitle>{project.name} - Calendar View</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4" ref={calendarRef}>
          {/* Calendar header with dates */}
          <div className="flex border-b overflow-x-auto sticky top-0 bg-background z-10">
            <div className="min-w-[150px] max-w-[150px] px-2 py-1 font-medium text-sm sticky left-0 bg-background z-20 border-r">Task</div>
            <div className="flex">
              {dateArray.map(date => (
                <div 
                  key={date.toISOString()} 
                  className={`min-w-[45px] w-[45px] flex-shrink-0 px-1 text-xs text-center border-r ${
                    date.getDay() === 0 || date.getDay() === 6 ? 'bg-muted/50' : ''
                  }`}
                >
                  <div>{format(date, "d")}</div>
                  <div className="text-[10px] text-muted-foreground">{format(date, "E")}</div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Calendar body with tasks */}
          <div className="overflow-x-auto relative"> {/* Added relative for task bar positioning */}
            {tasks?.map((task, taskIndex) => {
              const { left, width } = getTaskPosition(task);
              const dayWidthPx = 45; // Must match header cell width
              
              return (
                <div key={task.id} className="flex relative min-h-[40px] border-b items-stretch">
                  <div className="min-w-[150px] max-w-[150px] px-2 py-1 text-sm font-medium border-r flex items-center sticky left-0 bg-background z-10">
                    {task.name}
                  </div>
                  
                  {/* This container div represents the timeline for this task row */}
                  <div className="flex-1 relative h-full"> {/* Ensure this takes up height */}
                    {/* Task bar */}
                    <div 
                      className={`absolute top-1/2 -translate-y-1/2 h-7 rounded ${getStatusColor(task.status)} text-white text-xs flex items-center px-2 truncate shadow-sm ${onTaskClick ? 'cursor-pointer hover:brightness-110 transition-all' : ''}`}
                      style={{ 
                        left: `${left * dayWidthPx}px`, 
                        width: `${Math.max(width * dayWidthPx - 4, dayWidthPx - 4)}px`, // Ensure min width for visibility, -4 for padding
                      }}
                      title={`${task.name} (${task.start_date ? format(new Date(task.start_date), "MMM d") : 'N/A'} - ${task.end_date ? format(new Date(task.end_date), "MMM d") : 'N/A'})`}
                      onClick={() => handleTaskBarClick(task)} // Added onClick handler
                    >
                      {task.name}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {(!tasks || tasks.length === 0) && (
              <div className="text-center py-10 text-muted-foreground">
                No tasks found for this project
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

