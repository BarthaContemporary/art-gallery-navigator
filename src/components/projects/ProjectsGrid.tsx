import { useState } from "react";
import { ProjectWithLocation, useProjects } from "@/hooks/use-projects";
import { ProjectCard } from "./ProjectCard";
import { ProjectDialog } from "./ProjectDialog";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { ProjectCalendarView } from "./ProjectCalendarView";
import { useProjectTasks } from "@/hooks/use-project-tasks";

interface ProjectsGridProps {
  search: string;
  status: string;
  type: string;
}

export function ProjectsGrid({ search, status, type }: ProjectsGridProps) {
  const { data: projects, isLoading, isError } = useProjects({
    search,
    status,
    type,
  });
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<ProjectWithLocation | null>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectWithLocation | null>(null);
  
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [projectForCalendar, setProjectForCalendar] = useState<ProjectWithLocation | null>(null);
  
  // Get tasks for each project to display on cards
  const { data: allTasks } = useProjectTasks(undefined);
  
  // Group tasks by project ID
  const tasksByProject = allTasks?.reduce((acc, task) => {
    if (!acc[task.project_id]) {
      acc[task.project_id] = [];
    }
    acc[task.project_id].push(task);
    return acc;
  }, {} as Record<string, typeof allTasks>);

  const handleEditProject = (project: ProjectWithLocation) => {
    setProjectToEdit(project);
    setEditDialogOpen(true);
  };

  const handleDeleteProject = (project: ProjectWithLocation) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };
  
  const handleCalendarView = (project: ProjectWithLocation) => {
    setProjectForCalendar(project);
    setCalendarDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="text-center text-muted-foreground py-20">Loading projects...</div>
    );
  }

  if (isError) {
    return (
      <div className="text-center text-red-500 py-20">
        Failed to load projects. Please try again.
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-20">
        No projects found. {search || status !== "all" || type !== "all" ? "Try adjusting your filters." : ""}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onEdit={handleEditProject}
            onDelete={handleDeleteProject}
            onCalendar={handleCalendarView}
            tasks={tasksByProject?.[project.id]}
          />
        ))}
      </div>

      {projectToEdit && (
        <ProjectDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setProjectToEdit(null);
          }}
          project={projectToEdit}
        />
      )}

      <DeleteProjectDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setProjectToDelete(null);
        }}
        project={projectToDelete}
      />
      
      <ProjectCalendarView
        open={calendarDialogOpen}
        onOpenChange={(open) => {
          setCalendarDialogOpen(open);
          if (!open) setProjectForCalendar(null);
        }}
        project={projectForCalendar}
      />
    </>
  );
}
