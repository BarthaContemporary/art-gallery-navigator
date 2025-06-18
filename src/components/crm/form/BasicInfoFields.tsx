
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientFormData } from "../hooks/useCreateClientForm";

interface BasicInfoFieldsProps {
  formData: ClientFormData;
  onFormDataChange: (updates: Partial<ClientFormData>) => void;
}

export function BasicInfoFields({ formData, onFormDataChange }: BasicInfoFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label htmlFor="full_name">Full Name *</Label>
        <Input 
          id="full_name" 
          value={formData.full_name} 
          onChange={e => onFormDataChange({ full_name: e.target.value })} 
          required 
        />
      </div>
      
      <div>
        <Label htmlFor="email">Email</Label>
        <Input 
          id="email" 
          type="email" 
          value={formData.email} 
          onChange={e => onFormDataChange({ email: e.target.value })} 
        />
      </div>
      
      <div>
        <Label htmlFor="phone">Mobile Phone</Label>
        <Input 
          id="phone" 
          value={formData.phone} 
          onChange={e => onFormDataChange({ phone: e.target.value })} 
        />
      </div>
      
      <div>
        <Label htmlFor="company">Company</Label>
        <Input 
          id="company" 
          value={formData.company} 
          onChange={e => onFormDataChange({ company: e.target.value })} 
        />
      </div>
    </div>
  );
}
