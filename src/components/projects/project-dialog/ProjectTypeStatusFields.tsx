
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Control } from "react-hook-form";
import { z } from "zod";
import { ProjectFormSchema } from "./schema";

type FormValues = z.infer<typeof ProjectFormSchema>;

interface ProjectTypeStatusFieldsProps {
  control: Control<FormValues>;
}

export function ProjectTypeStatusFields({ control }: ProjectTypeStatusFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        control={control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="abandoned">Abandoned</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={control}
        name="type"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Type</FormLabel>
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="exhibition">Exhibition</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="publication">Publication</SelectItem>
                <SelectItem value="talk">Talk</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
