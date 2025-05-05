
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Control } from "react-hook-form";
import { z } from "zod";
import { taskFormSchema } from "./schema";
import { ProjectMember } from "@/hooks/projects/project-types";

type FormValues = z.infer<typeof taskFormSchema>;

interface TaskAssigneeFieldProps {
  control: Control<FormValues>;
  projectUsers: ProjectMember[];
}

export function TaskAssigneeField({ control, projectUsers }: TaskAssigneeFieldProps) {
  return (
    <FormField
      control={control}
      name="assigned_to"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Assigned To</FormLabel>
          <Select
            onValueChange={field.onChange}
            defaultValue={field.value}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Assign to user (optional)" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {projectUsers?.map(member => (
                <SelectItem key={member.user_id} value={member.user_id}>
                  {member.display_name || "User"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
