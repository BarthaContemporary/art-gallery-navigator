
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientFormData } from "../hooks/useCreateClientForm";

interface StatusFieldsProps {
  formData: ClientFormData;
  onFormDataChange: (updates: Partial<ClientFormData>) => void;
}

export function StatusFields({ formData, onFormDataChange }: StatusFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label htmlFor="status">Status</Label>
        <Select 
          value={formData.status} 
          onValueChange={(value: 'active' | 'inactive' | 'prospect' | 'lead' | 'customer') => 
            onFormDataChange({ status: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="client_type">Client Type</Label>
        <Select 
          value={formData.client_type} 
          onValueChange={value => onFormDataChange({ client_type: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="collector">Collector</SelectItem>
            <SelectItem value="dealer">Dealer</SelectItem>
            <SelectItem value="museum">Museum</SelectItem>
            <SelectItem value="interior_designer">Interior Designer</SelectItem>
            <SelectItem value="architect">Architect</SelectItem>
            <SelectItem value="art_advisor">Art Advisor</SelectItem>
            <SelectItem value="press">Press</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
