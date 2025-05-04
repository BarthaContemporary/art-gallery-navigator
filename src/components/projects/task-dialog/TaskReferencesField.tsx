
import { FormItem, FormLabel } from "@/components/ui/form";
import { ReferenceSelector } from "../ReferenceSelector";

interface TaskReferencesFieldProps {
  onReferencesChange: (refs: {type: 'document' | 'collection' | 'artwork' | 'artist', id: string}[]) => void;
}

export function TaskReferencesField({ onReferencesChange }: TaskReferencesFieldProps) {
  return (
    <FormItem>
      <FormLabel>References</FormLabel>
      <ReferenceSelector onReferencesChange={onReferencesChange} />
    </FormItem>
  );
}
