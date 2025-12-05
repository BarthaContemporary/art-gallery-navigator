import { useState } from "react";
import { useProjectTags, useTaskTags, useCreateProjectTag, useAddTagToTask, useRemoveTagFromTask } from "@/hooks/projects/use-project-tags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag, Plus, X, Check } from "lucide-react";

interface TaskTagsFieldProps {
  taskId: string;
  projectId: string;
}

const TAG_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', 
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
  '#8B5CF6', '#A855F7', '#EC4899', '#6B7280',
];

export function TaskTagsField({ taskId, projectId }: TaskTagsFieldProps) {
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [open, setOpen] = useState(false);
  
  const { data: projectTags } = useProjectTags(projectId);
  const { data: taskTags } = useTaskTags(taskId);
  const createTag = useCreateProjectTag();
  const addTag = useAddTagToTask();
  const removeTag = useRemoveTagFromTask();
  
  const taskTagIds = taskTags?.map(tt => tt.tag_id) || [];
  
  const handleAddTag = (tagId: string) => {
    if (taskTagIds.includes(tagId)) {
      removeTag.mutate({ task_id: taskId, tag_id: tagId });
    } else {
      addTag.mutate({ task_id: taskId, tag_id: tagId });
    }
  };
  
  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    createTag.mutate(
      { project_id: projectId, name: newTagName.trim(), color: selectedColor },
      {
        onSuccess: (newTag) => {
          addTag.mutate({ task_id: taskId, tag_id: newTag.id });
          setNewTagName("");
        },
      }
    );
  };
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-2">
        <Tag className="h-4 w-4" />
        Tags
      </label>
      
      {/* Current tags */}
      <div className="flex flex-wrap gap-1">
        {taskTags?.map((taskTag) => (
          <span
            key={taskTag.tag_id}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-white"
            style={{ backgroundColor: taskTag.tag?.color || '#6B7280' }}
          >
            {taskTag.tag?.name}
            <button
              onClick={() => removeTag.mutate({ task_id: taskId, tag_id: taskTag.tag_id })}
              className="hover:opacity-70"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 px-2">
              <Plus className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="space-y-2">
              {/* Existing tags */}
              {projectTags && projectTags.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Select tag</p>
                  <div className="flex flex-wrap gap-1">
                    {projectTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => handleAddTag(tag.id)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-white"
                        style={{ backgroundColor: tag.color || '#6B7280' }}
                      >
                        {taskTagIds.includes(tag.id) && <Check className="h-3 w-3" />}
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Create new tag */}
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground">Create new tag</p>
                <Input
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="h-7 text-sm"
                />
                <div className="flex flex-wrap gap-1">
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`h-5 w-5 ${selectedColor === color ? 'ring-2 ring-foreground ring-offset-1' : ''}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <Button
                  size="sm"
                  className="w-full h-7"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || createTag.isPending}
                >
                  Create Tag
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
