
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Location } from "@/hooks/use-locations";

const locationTypes = ["exhibition", "storage", "consignment", "external"] as const;

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(locationTypes, { required_error: "Please select a type" }),
  address: z.string().optional(),
  notes: z.string().optional(),
});

interface LocationFormProps {
  initialData?: Location;
  setOpen: (open: boolean) => void;
}

export function LocationForm({ initialData, setOpen }: LocationFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!initialData;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      type: (initialData?.type as any) || "exhibition",
      address: initialData?.address || "",
      notes: initialData?.notes || "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (isEditing) {
        const { error } = await supabase
          .from("locations")
          .update(values)
          .eq("id", initialData.id);

        if (error) throw error;
        
        toast.success("Location updated successfully");
      } else {
        const { error } = await supabase.from("locations").insert(values);
        
        if (error) throw error;
        
        toast.success("Location created successfully");
      }

      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["locations"] });
    } catch (error) {
      console.error("Error saving location:", error);
      toast.error("Failed to save location");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Location name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {locationTypes.map((type) => (
                    <SelectItem key={type} value={type} className="capitalize">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input placeholder="Location address" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Additional notes" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit">
            {isEditing ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
