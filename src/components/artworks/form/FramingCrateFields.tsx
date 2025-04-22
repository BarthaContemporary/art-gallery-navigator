
import { Switch } from "@/components/ui/switch";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import { ArtworkFormData } from "./types";
import { RulerIcon, Weight, SquareDashed } from "lucide-react";

interface FramingCrateFieldsProps {
  form: UseFormReturn<ArtworkFormData>;
}

export function FramingCrateFields({ form }: FramingCrateFieldsProps) {
  const isFramed = form.watch("is_framed");
  const hasCrate = form.watch("has_crate");

  return (
    <div className="space-y-6">
      {/* Work Framed toggle */}
      <FormField
        control={form.control}
        name="is_framed"
        render={({ field }) => (
          <FormItem className="flex items-center gap-4">
            <FormLabel className="flex items-center gap-2">
              <SquareDashed className="h-4 w-4" />
              Is the Work Framed?
            </FormLabel>
            <FormControl>
              <Switch
                checked={!!field.value}
                onCheckedChange={checked => field.onChange(checked)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {/* Frame dimensions */}
      {isFramed && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="frame_height"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Frame Height (cm)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} placeholder="Frame Height" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="frame_width"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Frame Width (cm)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} placeholder="Frame Width" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="frame_depth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Frame Depth (cm)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} placeholder="Frame Depth" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
      {/* Artwork Weight */}
      <FormField
        control={form.control}
        name="weight"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Weight className="h-4 w-4" />
              Artwork Weight (kg)
            </FormLabel>
            <FormControl>
              <Input type="number" {...field} placeholder="Artwork Weight" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {/* Has Crate toggle */}
      <FormField
        control={form.control}
        name="has_crate"
        render={({ field }) => (
          <FormItem className="flex items-center gap-4">
            <FormLabel className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Is there a Crate?
            </FormLabel>
            <FormControl>
              <Switch
                checked={!!field.value}
                onCheckedChange={checked => field.onChange(checked)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {/* Crate dimensions */}
      {hasCrate && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="crate_height"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Crate Height (cm)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} placeholder="Crate Height" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="crate_width"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Crate Width (cm)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} placeholder="Crate Width" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="crate_depth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Crate Depth (cm)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} placeholder="Crate Depth" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );
}
