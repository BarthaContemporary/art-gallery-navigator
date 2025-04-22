
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { UseFormReturn } from "react-hook-form";
import { ArtworkFormData } from "./types";
import { Book } from "lucide-react";

interface ProvenanceStoryFieldsProps {
  form: UseFormReturn<ArtworkFormData>;
}

export function ProvenanceStoryFields({ form }: ProvenanceStoryFieldsProps) {
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="provenance"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Book className="h-4 w-4" />
              Provenance
            </FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="Enter the artwork's provenance"
                className="min-h-[100px]"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="story"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Book className="h-4 w-4" />
              Tell the story of this work
            </FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="Share the story behind this artwork"
                className="min-h-[100px]"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="exhibition_history"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Book className="h-4 w-4" />
              Exhibition History
            </FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="List the exhibitions where this artwork has been shown"
                className="min-h-[100px]"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
