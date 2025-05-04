
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Control } from "react-hook-form";
import { z } from "zod";
import { taskFormSchema } from "./schema";

type FormValues = z.infer<typeof taskFormSchema>;

interface TaskAssigneeFieldProps {
  control: Control<FormValues>;
  projectUsers: any[] | undefined;
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
              {projectUsers?.map(user => {
                // Use a local variable for display name with a safe default
                let displayName = "User";
                
                // Use type assertions to help TypeScript understand the structure
                if (user && user.profiles) {
                  const profileData = user.profiles as { display_name?: string; avatar_url?: string | null };
                  displayName = profileData.display_name || "User";
                }
                
                return (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {displayName}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
