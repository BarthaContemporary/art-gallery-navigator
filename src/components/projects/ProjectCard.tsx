import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProjectWithLocation, TaskWithAssignee } from "@/hooks/projects";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { Calendar, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProjectCardActions } from "./ProjectCardActions";
import { Badge } from "@/components/ui/badge";

interface ProjectCardProps {
  project: ProjectWithLocation;
  onEdit?: (project: ProjectWithLocation) => void;
  onDelete?: (project: ProjectWithLocation) => void;
  onCalendar?: (project: ProjectWithLocation) => void;
  tasks?: TaskWithAssignee[];
}

export function ProjectCard({ project, onEdit, onDelete, onCalendar, tasks }: ProjectCardProps) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showActions, setShowActions] = useState(false);
  
  // Filter tasks that are active or scheduled and relevant to the current user
  const activeTasks = tasks?.filter(task => 
    task.status === 'active' || task.status === 'scheduled'
  ) || [];
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'abandoned': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const handleCardClick = () => {
    navigate(`/projects/${project.id}`);
  };
  
  return (
    <Card 
      className="group relative cursor-pointer transition-all hover:shadow-md"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div 
        className={`absolute inset-0 rounded-md ${showActions ? 'bg-black/5' : ''} transition-colors`}
        onClick={handleCardClick}
      ></div>
      
      {(isAdmin || showActions) && (
        <ProjectCardActions 
          project={project}
          onEdit={onEdit}
          onDelete={onDelete}
          onCalendar={onCalendar}
        />
      )}
      
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <h3 className="font-semibold text-lg truncate pr-2">{project.name}</h3>
          <Badge className={`${getStatusColor(project.status)}`}>
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </Badge>
        </div>
        <div className="flex items-center text-sm text-muted-foreground gap-1">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {project.start_date ? format(new Date(project.start_date), 'MMM d, yyyy') : 'N/A'} - {project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : 'N/A'}
          </span>
        </div>
      </CardHeader>
      
      <CardContent>
        {project.location && (
          <div className="flex items-center text-sm text-muted-foreground mb-2">
            <span>Location: {project.location.name}</span>
          </div>
        )}
        
        {project.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {project.description}
          </p>
        )}
        
        {activeTasks.length > 0 && (
          <div className="mt-2">
            <h4 className="text-xs font-medium text-muted-foreground mb-1.5">ACTIVE TASKS</h4>
            <ul className="space-y-1.5">
              {activeTasks.slice(0, 3).map(task => (
                <li key={task.id} className="text-xs flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate">{task.name}</span>
                </li>
              ))}
              {activeTasks.length > 3 && (
                <li className="text-xs text-muted-foreground">
                  + {activeTasks.length - 3} more tasks
                </li>
              )}
            </ul>
          </div>
        )}
        
        <Badge className="mt-3" variant="outline">
          {project.type.charAt(0).toUpperCase() + project.type.slice(1)}
        </Badge>
      </CardContent>
    </Card>
  );
}
