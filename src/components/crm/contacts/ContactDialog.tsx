import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCRMContact, useUpdateCRMContact } from "@/hooks/crm";
import { CRMContact, CRMContactType } from "@/types/crm";
import { useState, useEffect } from "react";

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: CRMContact;
}

export function ContactDialog({ open, onOpenChange, contact }: ContactDialogProps) {
  const [formData, setFormData] = useState({ full_name: "", email: "", phone: "", contact_type: "prospect" as CRMContactType, notes: "", instagram_handle: "", linkedin_handle: "", whatsapp_number: "", city: "", country: "" });

  const createContact = useCreateCRMContact();
  const updateContact = useUpdateCRMContact();

  useEffect(() => {
    if (contact) {
      setFormData({ full_name: contact.full_name, email: contact.email || "", phone: contact.phone || "", contact_type: contact.contact_type, notes: contact.notes || "", instagram_handle: contact.instagram_handle || "", linkedin_handle: contact.linkedin_handle || "", whatsapp_number: contact.whatsapp_number || "", city: contact.city || "", country: contact.country || "" });
    } else {
      setFormData({ full_name: "", email: "", phone: "", contact_type: "prospect", notes: "", instagram_handle: "", linkedin_handle: "", whatsapp_number: "", city: "", country: "" });
    }
  }, [contact, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (contact) {
      updateContact.mutate({ id: contact.id, ...formData }, { onSuccess: () => onOpenChange(false) });
    } else {
      createContact.mutate(formData, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit Contact" : "New Contact"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Label>Name *</Label><Input required value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
            <div><Label>Type</Label>
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
            <div><Label>City</Label><Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} /></div>
            <div><Label>Country</Label><Input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} /></div>
            <div><Label>Instagram</Label><Input placeholder="@handle" value={formData.instagram_handle} onChange={(e) => setFormData({ ...formData, instagram_handle: e.target.value })} /></div>
            <div><Label>LinkedIn</Label><Input value={formData.linkedin_handle} onChange={(e) => setFormData({ ...formData, linkedin_handle: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input value={formData.whatsapp_number} onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })} /></div>
            <div className="col-span-2"><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
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
