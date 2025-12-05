import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { useProjectSections, useInitializeDefaultSections, useCreateSection } from "@/hooks/projects/use-sections";
import { useKanbanTasks, useUpdateTaskPosition } from "@/hooks/projects/use-kanban-tasks";
import { ProjectSection, KanbanTask } from "@/hooks/projects/types/section-types";
import { Loader2, Plus } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { AddSectionDialog } from "./AddSectionDialog";

interface KanbanBoardProps {
  projectId: string;
  onTaskClick?: (task: KanbanTask) => void;
  onAddTask?: (sectionId?: string) => void;
}

export function KanbanBoard({ projectId, onTaskClick, onAddTask }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  
  const { data: sections, isLoading: sectionsLoading } = useProjectSections(projectId);
  const { data: tasks, isLoading: tasksLoading } = useKanbanTasks(projectId);
  const { mutate: initializeSections } = useInitializeDefaultSections();
  const { mutate: updateTaskPositions } = useUpdateTaskPosition();
  const { mutate: createSection } = useCreateSection();
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  
  // Initialize default sections if none exist
  useEffect(() => {
    if (!sectionsLoading && sections && sections.length === 0) {
      initializeSections(projectId);
    }
  }, [sectionsLoading, sections, projectId, initializeSections]);
  
  // Group tasks by section
  const tasksBySection = useMemo(() => {
    if (!tasks || !sections) return new Map<string, KanbanTask[]>();
    
    const grouped = new Map<string, KanbanTask[]>();
    
    // Initialize all sections with empty arrays
    sections.forEach(section => {
      grouped.set(section.id, []);
    });
    
    // Add "unsectioned" for tasks without a section
    grouped.set('unsectioned', []);
    
    // Group tasks
    tasks.forEach(task => {
      const sectionId = task.section_id || 'unsectioned';
      const sectionTasks = grouped.get(sectionId) || [];
      sectionTasks.push(task);
      grouped.set(sectionId, sectionTasks);
    });
    
    // Sort tasks within each section by position
    grouped.forEach((sectionTasks, key) => {
      grouped.set(key, sectionTasks.sort((a, b) => a.position - b.position));
    });
    
    return grouped;
  }, [tasks, sections]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks?.find(t => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Handle drag over for visual feedback if needed
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    
    if (!over || !tasks) return;
    
    const activeTask = tasks.find(t => t.id === active.id);
    if (!activeTask) return;
    
    let targetSectionId: string | null = null;
    let targetIndex = 0;
    
    // Determine target section and position
    const overData = over.data.current;
    
    if (overData?.type === 'section') {
      // Dropped on a section
      targetSectionId = over.id as string;
      targetIndex = tasksBySection.get(targetSectionId)?.length || 0;
    } else if (overData?.type === 'task') {
      // Dropped on another task
      const overTask = overData.task as KanbanTask;
      targetSectionId = overTask.section_id;
      const sectionTasks = tasksBySection.get(targetSectionId || 'unsectioned') || [];
      targetIndex = sectionTasks.findIndex(t => t.id === over.id);
      
      // If dragging within the same section, adjust index
      if (activeTask.section_id === targetSectionId) {
        const activeIndex = sectionTasks.findIndex(t => t.id === active.id);
        if (activeIndex < targetIndex) {
          targetIndex--;
        }
      }
    }
    
    // Calculate new positions for all affected tasks
    const updatedTasks: Array<{ id: string; position: number; section_id: string | null }> = [];
    
    // Get tasks in the target section (excluding the moved task)
    const sectionTasks = (tasksBySection.get(targetSectionId || 'unsectioned') || [])
      .filter(t => t.id !== activeTask.id);
    
    // Insert the moved task at the target position
    sectionTasks.splice(targetIndex, 0, { ...activeTask, section_id: targetSectionId });
    
    // Update positions
    sectionTasks.forEach((task, index) => {
      updatedTasks.push({
        id: task.id,
        position: index,
        section_id: targetSectionId,
      });
    });
    
    // If moving between sections, update positions in the source section too
    if (activeTask.section_id !== targetSectionId) {
      const sourceSectionTasks = (tasksBySection.get(activeTask.section_id || 'unsectioned') || [])
        .filter(t => t.id !== activeTask.id);
      
      sourceSectionTasks.forEach((task, index) => {
        updatedTasks.push({
          id: task.id,
          position: index,
          section_id: task.section_id,
        });
      });
    }
    
    updateTaskPositions(updatedTasks);
  };

  const handleAddSection = (name: string, color: string) => {
    const maxPosition = sections?.reduce((max, s) => Math.max(max, s.position), -1) ?? -1;
    createSection({
      project_id: projectId,
      name,
      color,
      position: maxPosition + 1,
    });
    setAddSectionOpen(false);
  };
  
  if (sectionsLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  // Create a virtual "Unsectioned" section for tasks without a section
  const unsectionedTasks = tasksBySection.get('unsectioned') || [];
  const hasUnsectionedTasks = unsectionedTasks.length > 0;

  return (
    <div className="h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <ScrollArea className="w-full">
          <div className="flex gap-4 p-4 min-h-[500px]">
            {/* Unsectioned column (only show if there are unsectioned tasks) */}
            {hasUnsectionedTasks && (
              <KanbanColumn
                section={{
                  id: 'unsectioned',
                  project_id: projectId,
                  name: 'Unsectioned',
                  color: '#9CA3AF',
                  position: -1,
                  created_at: '',
                  updated_at: '',
                }}
                tasks={unsectionedTasks}
                onTaskClick={onTaskClick}
                onAddTask={() => onAddTask?.()}
              />
            )}
            
            {/* Regular sections */}
            {sections?.map((section) => (
              <KanbanColumn
                key={section.id}
                section={section}
                tasks={tasksBySection.get(section.id) || []}
                onTaskClick={onTaskClick}
                onAddTask={(sectionId) => onAddTask?.(sectionId)}
              />
            ))}
            
            {/* Add section button */}
            <div className="w-72 min-w-[288px] flex-shrink-0">
              <Button
                variant="outline"
                className="w-full h-10 border-dashed"
                onClick={() => setAddSectionOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Section
              </Button>
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        
        <DragOverlay>
          {activeTask && (
            <div className="rotate-3 opacity-90">
              <KanbanCard task={activeTask} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
      
      <AddSectionDialog
        open={addSectionOpen}
        onOpenChange={setAddSectionOpen}
        onAdd={handleAddSection}
      />
    </div>
  );
}
