import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProject, useProjectUsers } from "@/hooks/use-projects";
import { useProjectTasks, TaskWithAssignee } from "@/hooks/use-project-tasks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Edit,
  MapPin,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { ProjectDialog } from "@/components/projects/ProjectDialog";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";
import { ProjectTaskDialog } from "@/components/projects/ProjectTaskDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { ProjectCalendarView } from "@/components/projects/ProjectCalendarView";

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { data: project, isLoading, isError } = useProject(id);
  const { data: projectUsers } = useProjectUsers(id);
  const { data: projectTasks } = useProjectTasks(id);
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [calendarViewOpen, setCalendarViewOpen] = useState(false);
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<TaskWithAssignee | null>(null);
  const [editTaskDialogOpen, setEditTaskDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  
  const userIsMember = projectUsers?.some(pu => pu.user_id === user?.id);
  
  const filteredTasks = (projectTasks || []).filter(task => {
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
  
  if (isLoading) {
    return <div className="p-6 text-center">Loading project details...</div>;
  }
  
  if (isError || !project) {
    return <div className="p-6 text-center text-red-500">Failed to load project details.</div>;
  }
  
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <Button 
        variant="ghost" 
        className="mb-4 flex items-center" 
        onClick={() => navigate("/projects")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
      </Button>
      
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <Badge className={`${getStatusColor(project.status)}`}>
              {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
            </Badge>
          </div>
          
          <div className="flex flex-wrap gap-6 mt-2">
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="mr-1 h-4 w-4" />
              <span>
                {format(new Date(project.start_date), 'MMMM d, yyyy')} - {format(new Date(project.end_date), 'MMMM d, yyyy')}
              </span>
            </div>
            
            {project.location && (
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="mr-1 h-4 w-4" />
                <span>{project.location.name}</span>
              </div>
            )}
            
            <Badge variant="outline">
              {project.type.charAt(0).toUpperCase() + project.type.slice(1)}
            </Badge>
          </div>
          
          {project.description && (
            <p className="mt-4 text-muted-foreground max-w-2xl">
              {project.description}
            </p>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline"
            onClick={() => setCalendarViewOpen(true)}
          >
            <Calendar className="mr-2 h-4 w-4" /> Calendar View
          </Button>
          
          {(isAdmin || userIsMember) && (
            <Button 
              onClick={() => setEditDialogOpen(true)}
            >
              <Edit className="mr-2 h-4 w-4" /> Edit Project
            </Button>
          )}
          
          {isAdmin && (
            <Button 
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          )}
        </div>
      </div>
      
      {/* Project members section */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <h2 className="text-lg font-semibold">Project Team</h2>
        </CardHeader>
        <CardContent>
          {projectUsers?.length === 0 ? (
            <div className="text-sm text-muted-foreground">No team members assigned.</div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {projectUsers?.map(projectUser => {
                // Fixed TypeScript error with proper null check and type handling
                let displayName = 'User';
                let avatarUrl = null;
                
                if (projectUser.profiles && 
                    typeof projectUser.profiles === 'object' && 
                    projectUser.profiles !== null) {
                  // Use type assertion to prevent TypeScript errors
                  const profileData = projectUser.profiles as { display_name?: string; avatar_url?: string | null };
                  displayName = profileData.display_name || 'User';
                  avatarUrl = profileData.avatar_url || null;
                }
                
                return (
                  <div key={projectUser.user_id} className="flex items-center gap-2">
                    <Avatar>
                      <AvatarImage src={avatarUrl || undefined} />
                      <AvatarFallback>
                        {displayName.substring(0, 2) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{displayName}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Tasks section */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Tasks</h2>
          
          {(isAdmin || userIsMember) && (
            <Button onClick={() => setCreateTaskDialogOpen(true)}>
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
                  <Card key={task.id} className="hover:bg-gray-50 transition-colors">
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
                        
                        {(isAdmin || userIsMember) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setTaskToEdit(task);
                              setEditTaskDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Dialogs */}
      <ProjectDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        project={project}
      />
      
      <DeleteProjectDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open && !project) navigate("/projects");
        }}
        project={project}
      />
      
      <ProjectCalendarView 
        open={calendarViewOpen}
        onOpenChange={setCalendarViewOpen}
        project={project}
      />
      
      <ProjectTaskDialog
        open={createTaskDialogOpen}
        onOpenChange={setCreateTaskDialogOpen}
        projectId={project.id}
      />
      
      {taskToEdit && (
        <ProjectTaskDialog
          open={editTaskDialogOpen}
          onOpenChange={(open) => {
            setEditTaskDialogOpen(open);
            if (!open) setTaskToEdit(null);
          }}
          projectId={project.id}
          task={taskToEdit}
        />
      )}
    </div>
  );
};

export default ProjectDetail;
