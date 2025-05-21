import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Edit, MapPin, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ProjectWithLocation } from "@/hooks/projects";

interface ProjectDetailHeaderProps {
  project: ProjectWithLocation;
  userIsMember: boolean;
  isAdmin: boolean;
  onEditClick: () => void;
  onDeleteClick: () => void;
  onCalendarViewClick: () => void;
}

export function ProjectDetailHeader({
  project,
  userIsMember,
  isAdmin,
  onEditClick,
  onDeleteClick,
  onCalendarViewClick
}: ProjectDetailHeaderProps) {
  const navigate = useNavigate();

  console.log("ProjectDetailHeader props:", { userIsMember, isAdmin, projectId: project.id });
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'abandoned': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleEditClick = () => {
    console.log("ProjectDetailHeader: Edit Project button clicked");
    onEditClick();
  };

  const handleDeleteClick = () => {
    console.log("ProjectDetailHeader: Delete Project button clicked");
    onDeleteClick();
  };

  const handleCalendarViewClick = () => {
    console.log("ProjectDetailHeader: Calendar View button clicked");
    onCalendarViewClick();
  };
  
  return (
    <>
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
            onClick={handleCalendarViewClick}
          >
            <Calendar className="mr-2 h-4 w-4" /> Calendar View
          </Button>
          
          {(isAdmin || userIsMember) && (
            <Button onClick={handleEditClick}>
              <Edit className="mr-2 h-4 w-4" /> Edit Project
            </Button>
          )}
          
          {isAdmin && (
            <Button 
              variant="destructive"
              onClick={handleDeleteClick}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
