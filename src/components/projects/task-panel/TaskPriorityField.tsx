import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag } from "lucide-react";

interface TaskPriorityFieldProps {
  value: string | null;
  onChange: (value: string) => void;
}

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'text-muted-foreground' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-500' },
  { value: 'high', label: 'High', color: 'text-orange-500' },
  { value: 'critical', label: 'Critical', color: 'text-red-500' },
];

export function TaskPriorityField({ value, onChange }: TaskPriorityFieldProps) {
  const currentPriority = PRIORITIES.find(p => p.value === value);
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-2">
        <Flag className="h-4 w-4" />
        Priority
      </label>
      <Select value={value || 'medium'} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select priority">
            {currentPriority && (
              <span className={currentPriority.color}>
                {currentPriority.label}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PRIORITIES.map((priority) => (
            <SelectItem key={priority.value} value={priority.value}>
              <span className={priority.color}>{priority.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: string | null }) {
  const priorityConfig = PRIORITIES.find(p => p.value === priority);
  if (!priorityConfig) return null;
  
  return (
    <span className={`text-xs font-medium ${priorityConfig.color}`}>
      {priorityConfig.label}
    </span>
  );
}
