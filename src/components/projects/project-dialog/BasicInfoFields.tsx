
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Control } from "react-hook-form";
import { z } from "zod";
import { ProjectFormSchema } from "./schema";

type FormValues = z.infer<typeof ProjectFormSchema>;

interface BasicInfoFieldsProps {
  control: Control<FormValues>;
}

export function BasicInfoFields({ control }: BasicInfoFieldsProps) {
  return (
    <>
      <FormField
        control={control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input placeholder="Project name" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea placeholder="Project description (optional)" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
