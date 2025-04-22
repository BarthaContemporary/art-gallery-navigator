
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import { ArtworkFormData } from "./types";

interface EditionFieldsProps {
  form: UseFormReturn<ArtworkFormData>;
  show: boolean;
}

export function EditionFields({ form, show }: EditionFieldsProps) {
  if (!show) return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name="edition_size"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Edition Size</FormLabel>
            <FormControl>
              <Input type="number" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={form.control}
        name="inventory_quantity"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Inventory Quantity</FormLabel>
            <FormControl>
              <Input type="number" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="available_works"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Available Works</FormLabel>
            <FormControl>
              <Input type="text" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="artist_proofs"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Artist Proofs</FormLabel>
            <FormControl>
              <Input type="number" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
