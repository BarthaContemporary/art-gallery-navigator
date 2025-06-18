
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArtistMultiSelect } from "../ArtistMultiSelect";
import { ClientFormData } from "../hooks/useCreateClientForm";

interface AdditionalInfoFieldsProps {
  formData: ClientFormData;
  onFormDataChange: (updates: Partial<ClientFormData>) => void;
}

export function AdditionalInfoFields({ formData, onFormDataChange }: AdditionalInfoFieldsProps) {
  return (
    <>
      <div>
        <Label htmlFor="interested_artists">Interested Artists</Label>
        <ArtistMultiSelect 
          selectedArtists={formData.interested_artists} 
          onArtistsChange={artists => onFormDataChange({ interested_artists: artists })} 
        />
      </div>
      
      <div>
        <Label htmlFor="address">Address</Label>
        <Textarea 
          id="address" 
          value={formData.address} 
          onChange={e => onFormDataChange({ address: e.target.value })} 
          rows={2} 
        />
      </div>
      
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea 
          id="notes" 
          value={formData.notes} 
          onChange={e => onFormDataChange({ notes: e.target.value })} 
          rows={3} 
          placeholder="Add any relevant notes about this client..." 
        />
      </div>
    </>
  );
}
