
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

interface CollectionFieldProps {
  form: UseFormReturn<UploadFormData>;
  disabled?: boolean;
}

export function CollectionField({ form, disabled }: CollectionFieldProps) {
  const { data: collections = [] } = useCollections();

  const options = collections.map((collection) => ({
    value: collection.id,
    label: collection.name,
  }));

  return (
    <FormField
      control={form.control}
      name="collection_id"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Related Collection</FormLabel>
          <FormControl>
            <SearchableSelect
              options={options}
              value={field.value || "_none"}
              onChange={field.onChange}
              placeholder="Select collection..."
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
