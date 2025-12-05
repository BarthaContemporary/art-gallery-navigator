import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { 
  useProject, 
  useProjectMembers, 
  useProjectTasks,
  ProjectWithLocation,
  TaskWithAssignee,
  KanbanTask
} from "@/hooks/projects";

import { ProjectDetailHeader } from "./ProjectDetailHeader";
import { ProjectTasksList } from "./ProjectTasksList";
import { ProjectDialogsManager } from "./ProjectDialogsManager";
import { useProjectDialogs } from "./useProjectDialogs";
import { useAuth } from "@/hooks/use-auth";
import { KanbanBoard } from "../kanban";
import { ViewSwitcher, ProjectView } from "../ViewSwitcher";
import { CalendarView, TimelineView, TaskFilters, defaultFilters, TaskFiltersState } from "../views";
import { EnhancedTaskPanel } from "../task-panel";

const ProjectDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  
  const projectDialogs = useProjectDialogs();
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [currentView, setCurrentView] = useState<ProjectView>('board');
  const [filters, setFilters] = useState<TaskFiltersState>(defaultFilters);
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignee | null>(null);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  
  const { 
    data: project, 
    isLoading, 
    isError, 
    error: projectError 
  } = useProject(id);
  
  const { 
    members, 
    isLoading: membersLoading, 
    isError: membersError,
    error: membersErrorDetails
  } = useProjectMembers(id);
  
  const { 
    data: projectTasks,
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErrorDetails
  } = useProjectTasks(id);
  
  useEffect(() => {
    if (membersError) {
      console.error("Members error:", membersErrorDetails);
    }
    if (tasksError) {
      console.error("Tasks error:", tasksErrorDetails);
    }
  }, [membersError, membersErrorDetails, tasksError, tasksErrorDetails]);
  
  const actualUserIsMember = isAdmin || (members?.some(member => member.user_id === user?.id) ?? false);
  
  if (isLoading) {
    return <div className="p-6 text-center">Loading project details...</div>;
  }
  
  if (isError || !project) {
    toast.error(`Failed to load project: ${projectError?.message || 'Unknown error'}`);
    return (
      <div className="p-6 text-center">
        <div className="text-red-500 mb-4">Failed to load project details.</div>
        <button 
          onClick={() => navigate("/projects")}
          className="px-4 py-2 bg-primary text-white"
        >
          Return to Projects
        </button>
      </div>
    );
  }
  
  const handleCloseMemberDialog = () => {
    setAddMemberDialogOpen(false);
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['project-members', id] });
    }, 300);
  };

  const handleKanbanTaskClick = (task: KanbanTask) => {
    // Convert KanbanTask to TaskWithAssignee for the panel
    const taskWithAssignee: TaskWithAssignee = {
      id: task.id,
      project_id: task.project_id,
      name: task.name,
      description: task.description,
      status: task.status,
      start_date: task.start_date,
      end_date: task.end_date,
      assigned_to: task.assigned_to,
      created_at: task.created_at,
      updated_at: task.updated_at,
      assignee: task.assignee,
      section_id: task.section_id,
      priority: task.priority,
      position: task.position,
    };
    setSelectedTask(taskWithAssignee);
    setTaskPanelOpen(true);
  };

  const handleTaskClick = (task: TaskWithAssignee) => {
    setSelectedTask(task);
    setTaskPanelOpen(true);
  };

  const handleAddTaskFromKanban = (sectionId?: string) => {
    projectDialogs.setCreateTaskDialogOpen(true);
  };

  // Filter tasks based on current filters
  const filteredTasks = projectTasks?.filter(task => {
    if (filters.search && !task.name.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.status !== 'all' && task.status !== filters.status) {
      return false;
    }
    if (filters.priority !== 'all' && task.priority !== filters.priority) {
      return false;
    }
    if (filters.assignee !== 'all') {
      if (filters.assignee === 'unassigned' && task.assigned_to) {
        return false;
      }
      if (filters.assignee !== 'unassigned' && task.assigned_to !== filters.assignee) {
        return false;
      }
    }
    return true;
  });
  
  return (
    <div className="p-4 sm:p-6 max-w-full mx-auto">
      <ProjectDetailHeader 
        project={project!} 
        userIsMember={actualUserIsMember}
        isAdmin={isAdmin}
        onEditClick={() => projectDialogs.setEditDialogOpen(true)}
        onDeleteClick={() => projectDialogs.setDeleteDialogOpen(true, project!, navigate)} 
        onCalendarViewClick={() => projectDialogs.setCalendarViewOpen(true)}
      />
      
      {/* View Switcher and Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <ViewSwitcher view={currentView} onViewChange={setCurrentView} />
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {id && <TaskFilters projectId={id} filters={filters} onFiltersChange={setFilters} />}
          
          {(isAdmin || actualUserIsMember) && (
            <button
              onClick={() => projectDialogs.setCreateTaskDialogOpen(true)}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap"
            >
              Add Task
            </button>
          )}
        </div>
      </div>
      
      {/* View Content */}
      {currentView === 'board' && id && (
        <KanbanBoard
          projectId={id}
          onTaskClick={handleKanbanTaskClick}
          onAddTask={handleAddTaskFromKanban}
        />
      )}
      
      {currentView === 'list' && (
        <ProjectTasksList 
          tasks={filteredTasks}
          isAdmin={isAdmin}
          userIsMember={actualUserIsMember}
          onCreateTask={() => projectDialogs.setCreateTaskDialogOpen(true)}
          onEditTask={handleTaskClick}
          isLoading={tasksLoading}
          isError={tasksError}
        />
      )}
      
      {currentView === 'calendar' && id && (
        <CalendarView
          tasks={filteredTasks || []}
          onTaskClick={handleTaskClick}
        />
      )}
      
      {currentView === 'timeline' && id && (
        <TimelineView
          tasks={filteredTasks || []}
          onTaskClick={handleTaskClick}
        />
      )}

      {/* Enhanced Task Panel */}
      {selectedTask && id && (
        <EnhancedTaskPanel
          task={selectedTask}
          projectId={id}
          open={taskPanelOpen}
          onOpenChange={setTaskPanelOpen}
        />
      )}
      
      <ProjectDialogsManager
        project={project!} 
        dialogStates={{
          ...projectDialogs,
          addMemberDialogOpen, 
          onCloseMemberDialog: handleCloseMemberDialog 
        }}
        navigate={navigate}
      />
    </div>
  );
};

export default ProjectDetailPage;
