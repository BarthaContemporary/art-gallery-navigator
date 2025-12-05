import { useState } from "react";
import { useSubtasks, useCreateSubtask, useUpdateSubtask, useDeleteSubtask, Subtask } from "@/hooks/projects/use-subtasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Loader2 } from "lucide-react";

interface TaskSubtasksProps {
  taskId: string;
}

export function TaskSubtasks({ taskId }: TaskSubtasksProps) {
  const [newSubtask, setNewSubtask] = useState("");
  const { data: subtasks, isLoading } = useSubtasks(taskId);
  const createSubtask = useCreateSubtask();
  const updateSubtask = useUpdateSubtask();
  const deleteSubtask = useDeleteSubtask();
  
  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    
    createSubtask.mutate({
      task_id: taskId,
      name: newSubtask.trim(),
      position: subtasks?.length || 0,
    });
    setNewSubtask("");
  };
  
  const handleToggleComplete = (subtask: Subtask) => {
    updateSubtask.mutate({
      id: subtask.id,
      task_id: taskId,
      is_completed: !subtask.is_completed,
    });
  };
  
  const handleDelete = (id: string) => {
    deleteSubtask.mutate({ id, task_id: taskId });
  };
  
  const completedCount = subtasks?.filter(s => s.is_completed).length || 0;
  const totalCount = subtasks?.length || 0;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Subtasks</h4>
        {totalCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {completedCount}/{totalCount} completed
          </span>
        )}
      </div>
      
      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="h-1.5 bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      )}
      
      {/* Subtask list */}
      <div className="space-y-1">
        {subtasks?.map((subtask) => (
          <div
            key={subtask.id}
            className="flex items-center gap-2 group py-1"
          >
            <Checkbox
              checked={subtask.is_completed}
              onCheckedChange={() => handleToggleComplete(subtask)}
            />
            <span className={`flex-1 text-sm ${subtask.is_completed ? 'line-through text-muted-foreground' : ''}`}>
              {subtask.name}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={() => handleDelete(subtask.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
      
      {/* Add new subtask */}
      <div className="flex gap-2">
        <Input
          placeholder="Add a subtask..."
          value={newSubtask}
          onChange={(e) => setNewSubtask(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
          className="h-8 text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleAddSubtask}
          disabled={!newSubtask.trim() || createSubtask.isPending}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
