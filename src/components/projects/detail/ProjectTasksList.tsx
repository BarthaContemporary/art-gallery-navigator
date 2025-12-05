import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { TaskWithAssignee } from "@/hooks/projects";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProjectTasksListProps {
  tasks: TaskWithAssignee[] | undefined;
  isAdmin: boolean;
  userIsMember: boolean;
  onCreateTask: () => void;
  onEditTask: (task: TaskWithAssignee) => void;
  isLoading?: boolean;
  isError?: boolean;
}

export function ProjectTasksList({ 
  tasks, 
  isAdmin, 
  userIsMember, 
  onCreateTask, 
  onEditTask,
  isLoading,
  isError
}: ProjectTasksListProps) {
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'abandoned': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCreateTaskClick = () => {
    console.log("ProjectTasksList: Add Task button clicked");
    onCreateTask();
  };

  const handleEditTaskRowClick = (task: TaskWithAssignee) => {
    console.log("ProjectTasksList: Edit Task row clicked for task:", task.id, task.name);
    if (isAdmin || userIsMember) {
      onEditTask(task);
    } else {
      console.log("ProjectTasksList: User not authorized to edit task row.");
    }
  };
  
  return (
    <Card>
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading tasks...</span>
          </div>
        ) : isError ? (
          <div className="py-6 text-center">
            <p className="text-sm text-red-500">Failed to load tasks. Please try again.</p>
          </div>
        ) : !tasks || tasks.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">No tasks created yet.</p>
            {(isAdmin || userIsMember) && (
              <Button 
                variant="link" 
                onClick={handleCreateTaskClick}
                className="mt-2"
              >
                Create your first task
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Assigned To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map(task => (
                  <TableRow 
                    key={task.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleEditTaskRowClick(task)}
                  >
                    <TableCell className="font-medium">{task.name}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(task.status)}>
                        {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>{task.end_date ? format(new Date(task.end_date), 'MMM d, yyyy') : 'N/A'}</TableCell>
                    <TableCell>{task.assignee?.display_name || 'Unassigned'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
