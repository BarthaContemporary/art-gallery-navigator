
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useCollections } from "@/hooks/use-collections";
import { UseFormReturn } from "react-hook-form";
import { UploadFormData } from "../upload-document-schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CollectionFieldProps {
  form: UseFormReturn<UploadFormData>;
  disabled?: boolean;
}

export function CollectionField({ form, disabled }: CollectionFieldProps) {
  const { data: collections } = useCollections();

  return (
    <FormField
      control={form.control}
      name="collection_id"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Related Collection</FormLabel>
          <FormControl>
            <Select
              disabled={disabled}
              value={field.value || ""}
              onValueChange={field.onChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select collection..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">None</SelectItem>
                {collections?.map((collection) => (
                  <SelectItem key={collection.id} value={collection.id}>
                    {collection.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
