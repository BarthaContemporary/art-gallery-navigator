
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

interface CollectionFieldProps {
  form: UseFormReturn<UploadFormData>;
  disabled?: boolean;
}

export function CollectionField({ form, disabled }: CollectionFieldProps) {
  const { data: collections, isLoading } = useCollections();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filter collections based on search term
  const filteredCollections = (collections || [])
    .filter(collection => 
      !searchTerm || 
      collection.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  
  // Reset search when reopening
  useEffect(() => {
    if (!disabled) {
      setSearchTerm("");
    }
  }, [disabled]);

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

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
              onValueChange={(value) => {
                field.onChange(value === "no_collection" ? "" : value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select collection" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <Input
                    placeholder="Search collections..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mb-2"
                  />
                </div>
                <SelectItem value="no_collection">None</SelectItem>
                {filteredCollections.map((collection) => (
                  <SelectItem key={collection.id} value={collection.id}>
                    {collection.name || "Untitled collection"}
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
