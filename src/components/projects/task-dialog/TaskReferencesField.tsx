
import { FormItem, FormLabel } from "@/components/ui/form";
import { ReferenceSelector } from "../ReferenceSelector";

// This is the type ReferenceSelector expects for its items, including name
interface ReferenceWithName {
  type: 'document' | 'collection' | 'artwork' | 'artist';
  id: string;
  name: string; 
}

interface TaskReferencesFieldProps {
  onReferencesChange: (refs: {type: 'document' | 'collection' | 'artwork' | 'artist', id: string}[]) => void;
  initialReferences?: ReferenceWithName[]; // Added initialReferences prop with name
}

export function TaskReferencesField({ onReferencesChange, initialReferences }: TaskReferencesFieldProps) {
  return (
    <FormItem>
      <FormLabel>References</FormLabel>
      <ReferenceSelector 
        onReferencesChange={onReferencesChange} 
        initialReferences={initialReferences} // Pass it to ReferenceSelector
      />
    </FormItem>
  );
}
