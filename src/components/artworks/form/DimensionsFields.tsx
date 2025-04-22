
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import { ArtworkFormData } from "./types";
import { RulerIcon, ArrowLeftRight, ArrowUpDown } from "lucide-react";

interface DimensionsFieldsProps {
  form: UseFormReturn<ArtworkFormData>;
}

export function DimensionsFields({ form }: DimensionsFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <FormField
        control={form.control}
        name="height"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4" />
              Height (cm)
            </FormLabel>
            <FormControl>
              <Input type="number" {...field} placeholder="Height" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="width"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Width (cm)
            </FormLabel>
            <FormControl>
              <Input type="number" {...field} placeholder="Width" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="depth"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <RulerIcon className="h-4 w-4" />
              Depth (cm)
            </FormLabel>
            <FormControl>
              <Input type="number" {...field} placeholder="Depth" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
