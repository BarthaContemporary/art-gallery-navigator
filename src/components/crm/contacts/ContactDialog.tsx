import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCRMContact, useUpdateCRMContact, useEmailEnrichment } from "@/hooks/crm";
import { CRMContact, CRMContactType } from "@/types/crm";
import { useState, useEffect } from "react";
import { AddressInput } from "@/components/crm/form/AddressInput";
import { EmailVerificationInput } from "@/components/crm/form/EmailVerificationInput";
import { EnrichmentResultsPanel } from "@/components/crm/form/EnrichmentResultsPanel";
import { PhoneInputWithWhatsApp } from "@/components/crm/form/PhoneInputWithWhatsApp";
import { LinkedInSearchInput } from "@/components/crm/contacts/LinkedInSearchInput";
import { Search, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: CRMContact;
}

const initialFormData = {
  full_name: "",
  email: "",
  phone: "",
  secondary_phone: "",
  contact_type: "prospect" as CRMContactType,
  notes: "",
  instagram_handle: "",
  linkedin_handle: "",
  whatsapp_number: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
  profile_image_url: "",
};

export function ContactDialog({ open, onOpenChange, contact }: ContactDialogProps) {
  const [formData, setFormData] = useState(initialFormData);

  const createContact = useCreateCRMContact();
  const updateContact = useUpdateCRMContact();
  const { enrichEmail, isLoading: isEnriching, result: enrichmentResult } = useEmailEnrichment();

  useEffect(() => {
    if (contact) {
      setFormData({
        full_name: contact.full_name,
        email: contact.email || "",
        phone: contact.phone || "",
        secondary_phone: contact.secondary_phone || "",
        contact_type: contact.contact_type,
        notes: contact.notes || "",
        instagram_handle: contact.instagram_handle || "",
        linkedin_handle: contact.linkedin_handle || "",
        whatsapp_number: contact.whatsapp_number || "",
        address_line1: contact.address_line1 || "",
        address_line2: contact.address_line2 || "",
        city: contact.city || "",
        state: contact.state || "",
        postal_code: contact.postal_code || "",
        country: contact.country || "",
        profile_image_url: contact.profile_image_url || "",
      });
    } else {
      setFormData(initialFormData);
    }
  }, [contact, open]);

  const handleEnrichFromEmail = async () => {
    if (!formData.email) return;
    await enrichEmail(formData.email);
  };

  const handleAddEnrichmentField = (field: string, value: string) => {
    if (field === 'notes' && formData.notes) {
      // Append bio to existing notes
      setFormData(prev => ({
        ...prev,
        notes: prev.notes + '\n\n' + value,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (contact) {
      updateContact.mutate({ id: contact.id, ...formData }, { onSuccess: () => onOpenChange(false) });
    } else {
      createContact.mutate(formData, { onSuccess: () => onOpenChange(false) });
    }
  };

  const handleAddressChange = (address: {
    address_line1: string;
    address_line2: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  }) => {
    setFormData((prev) => ({ ...prev, ...address }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit Contact" : "New Contact"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Name - full width with search button */}
            <div className="col-span-2">
              <Label>Name *</Label>
              <div className="flex gap-2">
                <Input 
                  required 
                  value={formData.full_name} 
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} 
                  className="flex-1"
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleEnrichFromEmail}
                        disabled={isEnriching || !formData.email}
                      >
                        {isEnriching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Look up profile from email</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Enrichment Results Panel */}
            {enrichmentResult && enrichmentResult.source !== 'none' && (
              <EnrichmentResultsPanel
                result={enrichmentResult}
                onAddField={handleAddEnrichmentField}
                currentValues={{
                  full_name: formData.full_name,
                  notes: formData.notes,
                  city: formData.city,
                  instagram_handle: formData.instagram_handle,
                  linkedin_handle: formData.linkedin_handle,
                }}
              />
            )}

            {/* Email - full width */}
            <div className="col-span-2">
              <EmailVerificationInput
                value={formData.email}
                onChange={(value) => setFormData({ ...formData, email: value })}
              />
            </div>

            {/* Phone fields - landline and mobile with WhatsApp check */}
            <PhoneInputWithWhatsApp
              landlineValue={formData.phone}
              mobileValue={formData.secondary_phone}
              whatsappValue={formData.whatsapp_number}
              onLandlineChange={(value) => setFormData({ ...formData, phone: value })}
              onMobileChange={(value) => setFormData({ ...formData, secondary_phone: value })}
              onWhatsappChange={(value) => setFormData({ ...formData, whatsapp_number: value })}
            />

            <div>
              <Label>Type</Label>
              <Select value={formData.contact_type} onValueChange={(v) => setFormData({ ...formData, contact_type: v as CRMContactType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="collector">Collector</SelectItem>
                  <SelectItem value="curator">Curator</SelectItem>
                  <SelectItem value="press">Press</SelectItem>
                  <SelectItem value="institution">Institution</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Instagram</Label>
              <Input placeholder="@handle" value={formData.instagram_handle} onChange={(e) => setFormData({ ...formData, instagram_handle: e.target.value })} />
            </div>
            <div className="col-span-2">
              <LinkedInSearchInput
                fullName={formData.full_name}
                linkedinHandle={formData.linkedin_handle}
                profileImageUrl={formData.profile_image_url}
                onLinkedInChange={(handle) => setFormData({ ...formData, linkedin_handle: handle })}
                onProfileImageChange={(url) => setFormData({ ...formData, profile_image_url: url })}
                contactId={contact?.id}
              />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input value={formData.whatsapp_number} onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })} />
            </div>
            
            {/* Address Section */}
            <div className="col-span-2">
              <AddressInput
                value={{
                  address_line1: formData.address_line1,
                  address_line2: formData.address_line2,
                  city: formData.city,
                  state: formData.state,
                  postal_code: formData.postal_code,
                  country: formData.country,
                }}
                onChange={handleAddressChange}
              />
            </div>
            
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createContact.isPending || updateContact.isPending}>{contact ? "Save" : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
