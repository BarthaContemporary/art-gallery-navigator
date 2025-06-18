
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientFormData } from "../hooks/useCreateClientForm";

interface ContactInfoFieldsProps {
  formData: ClientFormData;
  onFormDataChange: (updates: Partial<ClientFormData>) => void;
}

export function ContactInfoFields({ formData, onFormDataChange }: ContactInfoFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label htmlFor="website">Website</Label>
        <Input 
          id="website" 
          value={formData.website} 
          onChange={e => onFormDataChange({ website: e.target.value })} 
        />
      </div>
      
      <div>
        <Label htmlFor="source">Source</Label>
        <Input 
          id="source" 
          value={formData.source} 
          onChange={e => onFormDataChange({ source: e.target.value })} 
          placeholder="e.g., Website, Referral, Event" 
        />
      </div>

      <div>
        <Label htmlFor="instagram_handle">Instagram Handle</Label>
        <Input 
          id="instagram_handle" 
          value={formData.instagram_handle} 
          onChange={e => onFormDataChange({ instagram_handle: e.target.value })} 
          placeholder="@username" 
        />
      </div>

      <div>
        <Label htmlFor="linkedin_handle">LinkedIn Handle</Label>
        <Input 
          id="linkedin_handle" 
          value={formData.linkedin_handle} 
          onChange={e => onFormDataChange({ linkedin_handle: e.target.value })} 
          placeholder="linkedin.com/in/username" 
        />
      </div>
    </div>
  );
}
