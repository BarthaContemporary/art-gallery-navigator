
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";

interface CreateLocationForm {
  name: string;
  type: string;
  address?: string;
  notes?: string;
}

export const CreateLocationDialog = () => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  
  const form = useForm<CreateLocationForm>({
    defaultValues: {
      name: "",
      type: "exhibition", // Set a default value for type
      address: "",
      notes: ""
    }
  });

  const onSubmit = async (data: CreateLocationForm) => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase.from('locations')
        .insert({
          name: data.name,
          type: data.type,
          address: data.address,
          notes: data.notes
        });
      
      if (error) throw error;
      
      toast.success("Location created successfully");
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error('Error creating location:', error);
      toast.error("Failed to create location");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Location
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Location</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: "Location name is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter location name" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="type"
              rules={{ required: "Location type is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type *</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="exhibition">Exhibition Space</SelectItem>
                      <SelectItem value="storage">Storage</SelectItem>
                      <SelectItem value="consignment">Consignment</SelectItem>
                      <SelectItem value="external">External</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <Input placeholder="Enter address (optional)" {...field} />
                  </FormControl>
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
                    <Textarea 
                      placeholder="Enter additional information (optional)" 
                      {...field} 
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Location"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
