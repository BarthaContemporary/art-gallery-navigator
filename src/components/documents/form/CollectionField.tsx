
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";

interface CollectionFieldProps {
  form: UseFormReturn<UploadFormData>;
  disabled?: boolean;
}

export function CollectionField({ form, disabled }: CollectionFieldProps) {
  const { data: collections, isLoading } = useCollections();

  // Create options only when collections are loaded
  const options = (collections || []).map((collection) => ({
    value: collection.id,
    label: collection.name || "Untitled collection",
  }));

  return (
    <FormField
      control={form.control}
      name="collection_id"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Related Collection</FormLabel>
          <FormControl>
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <SearchableSelect
                options={options}
                value={field.value || "_none"}
                onChange={field.onChange}
                placeholder="Select collection..."
                disabled={disabled}
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
