import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArtistMultiSelect } from "./ArtistMultiSelect";
import { ClientFormData } from "./hooks/useCreateClientForm";
interface ClientFormFieldsProps {
  formData: ClientFormData;
  onFormDataChange: (updates: Partial<ClientFormData>) => void;
}
export function ClientFormFields({
  formData,
  onFormDataChange
}: ClientFormFieldsProps) {
  return <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="full_name">Full Name *</Label>
          <Input id="full_name" value={formData.full_name} onChange={e => onFormDataChange({
          full_name: e.target.value
        })} required />
        </div>
        
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={formData.email} onChange={e => onFormDataChange({
          email: e.target.value
        })} />
        </div>
        
        <div>
          <Label htmlFor="phone">Mobile Phone</Label>
          <Input id="phone" value={formData.phone} onChange={e => onFormDataChange({
          phone: e.target.value
        })} />
        </div>
        
        <div>
          <Label htmlFor="company">Company</Label>
          <Input id="company" value={formData.company} onChange={e => onFormDataChange({
          company: e.target.value
        })} />
        </div>
        
        <div>
          <Label htmlFor="website">Website</Label>
          <Input id="website" value={formData.website} onChange={e => onFormDataChange({
          website: e.target.value
        })} />
        </div>
        
        <div>
          <Label htmlFor="source">Source</Label>
          <Input id="source" value={formData.source} onChange={e => onFormDataChange({
          source: e.target.value
        })} placeholder="e.g., Website, Referral, Event" />
        </div>
        
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value: 'active' | 'inactive' | 'prospect' | 'lead' | 'customer') => onFormDataChange({
          status: value
        })}>
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
          <Select value={formData.client_type} onValueChange={value => onFormDataChange({
          client_type: value
        })}>
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

      <div>
        <Label htmlFor="interested_artists">Interested Artists</Label>
        <ArtistMultiSelect selectedArtists={formData.interested_artists} onArtistsChange={artists => onFormDataChange({
        interested_artists: artists
      })} />
      </div>
      
      <div>
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" value={formData.address} onChange={e => onFormDataChange({
        address: e.target.value
      })} rows={2} />
      </div>
      
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={formData.notes} onChange={e => onFormDataChange({
        notes: e.target.value
      })} rows={3} placeholder="Add any relevant notes about this client..." />
      </div>
    </>;
}