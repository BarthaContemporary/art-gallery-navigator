import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProjectWithLocation } from "@/hooks/use-projects";
import { TaskWithAssignee, useProjectTasks } from "@/hooks/use-project-tasks";
import { useProjectMembers } from "@/hooks/projects/use-project-members";
import { format } from "date-fns";

interface ProjectCalendarViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectWithLocation | null;
}

export function ProjectCalendarView({ open, onOpenChange, project }: ProjectCalendarViewProps) {
  const { data: tasks } = useProjectTasks(project?.id);
  const { members: projectMembers } = useProjectMembers(project?.id);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  if (!project) return null;
  
  // Format dates
  const startDate = new Date(project.start_date);
  const endDate = new Date(project.end_date);
  
  // Calculate how many days the project spans
  const projectDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  // Generate an array of dates for the calendar
  const dateArray = Array.from({ length: projectDays }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    return date;
  });
  
  const getTaskPosition = (task: TaskWithAssignee) => {
    const taskStart = new Date(task.start_date);
    const taskEnd = new Date(task.end_date);
    
    // Calculate position as percentage from left edge
    const left = Math.max(0, (taskStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate width (duration) as day count
    const width = Math.ceil((taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    return { left, width };
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-screen overflow-auto">
        <DialogHeader>
          <DialogTitle>{project.name} - Calendar View</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4" ref={calendarRef}>
          {/* Calendar header with dates */}
          <div className="flex border-b overflow-x-auto">
            <div className="min-w-[120px] px-2 py-1 font-medium text-sm">Task</div>
            {dateArray.map(date => (
              <div 
                key={date.toISOString()} 
                className={`min-w-[40px] w-[40px] flex-shrink-0 px-1 text-xs text-center border-r ${
                  date.getDay() === 0 || date.getDay() === 6 ? 'bg-gray-100' : ''
                }`}
              >
                <div>{format(date, "d")}</div>
                <div className="text-[10px] text-gray-500">{format(date, "E")}</div>
              </div>
            ))}
          </div>
          
          {/* Calendar body with tasks */}
          <div className="overflow-x-auto">
            {tasks?.map(task => {
              const { left, width } = getTaskPosition(task);
              
              return (
                <div key={task.id} className="flex relative min-h-[40px] border-b">
                  <div className="min-w-[120px] px-2 py-1 text-sm font-medium border-r flex items-center">
                    {task.name}
                  </div>
                  
                  <div className="flex-1 relative">
                    {/* Task bar */}
                    <div 
                      className={`absolute top-1 h-7 rounded ${getStatusColor(task.status)} text-white text-xs flex items-center px-2 truncate shadow-sm`}
                      style={{ 
                        left: `${left * 40}px`, 
                        width: `${Math.max(width * 40 - 4, 20)}px`
                      }}
                      title={`${task.name} (${format(new Date(task.start_date), "MMM d")} - ${format(new Date(task.end_date), "MMM d")})`}
                    >
                      {task.name}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {tasks?.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              No tasks found for this project
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
