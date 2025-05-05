
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Edit, Plus, User } from "lucide-react";
import { format } from "date-fns";
import { TaskWithAssignee } from "@/hooks/projects/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

interface ProjectTasksListProps {
  tasks: TaskWithAssignee[] | undefined;
  isAdmin: boolean;
  userIsMember: boolean;
  onCreateTask: () => void;
  onEditTask: (task: TaskWithAssignee) => void;
}

export function ProjectTasksList({ 
  tasks, 
  isAdmin, 
  userIsMember, 
  onCreateTask, 
  onEditTask 
}: ProjectTasksListProps) {
  const [activeTab, setActiveTab] = useState("active");
  
  const filteredTasks = (tasks || []).filter(task => {
    if (activeTab === "all") return true;
    return task.status === activeTab;
  });
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'abandoned': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Tasks</h2>
        
        {(isAdmin || userIsMember) && (
          <Button onClick={onCreateTask}>
            <Plus className="mr-2 h-4 w-4" /> Add Task
          </Button>
        )}
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="abandoned">Abandoned</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab} className="mt-4">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No {activeTab !== 'all' ? activeTab : ''} tasks found.
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task}
                  showEditButton={isAdmin || userIsMember}
                  onEditClick={() => onEditTask(task)}
                  getStatusColor={getStatusColor}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface TaskCardProps {
  task: TaskWithAssignee;
  showEditButton: boolean;
  onEditClick: () => void;
  getStatusColor: (status: string) => string;
}

function TaskCard({ task, showEditButton, onEditClick, getStatusColor }: TaskCardProps) {
  return (
    <Card className="hover:bg-gray-50 transition-colors">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium">{task.name}</h3>
              <Badge className={`${getStatusColor(task.status)}`}>
                {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
              </Badge>
            </div>
            
            {task.description && (
              <p className="text-sm text-muted-foreground max-w-2xl">
                {task.description}
              </p>
            )}
            
            <div className="flex flex-wrap gap-4 mt-2">
              <div className="flex items-center text-sm text-muted-foreground">
                <Clock className="mr-1 h-4 w-4" />
                <span>
                  {format(new Date(task.start_date), 'MMM d, yyyy')} - {format(new Date(task.end_date), 'MMM d, yyyy')}
                </span>
              </div>
              
              {task.assignee && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <User className="mr-1 h-4 w-4" />
                  <span>{task.assignee.display_name || "Unassigned"}</span>
                </div>
              )}
            </div>
          </div>
          
          {showEditButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEditClick}
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
