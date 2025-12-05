import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCRMOrganization } from "@/hooks/crm";
import { CRMOrganizationType } from "@/types/crm";
import { useState } from "react";

interface OrganizationDialogProps { open: boolean; onOpenChange: (open: boolean) => void; }

export function OrganizationDialog({ open, onOpenChange }: OrganizationDialogProps) {
  const [formData, setFormData] = useState({ name: "", type: "other" as CRMOrganizationType, website: "", city: "", country: "" });
  const createOrg = useCreateCRMOrganization();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOrg.mutate(formData, { onSuccess: () => { onOpenChange(false); setFormData({ name: "", type: "other", website: "", city: "", country: "" }); } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Organization</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Name *</Label><Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
          <div><Label>Type</Label>
            <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as CRMOrganizationType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gallery">Gallery</SelectItem>
                <SelectItem value="museum">Museum</SelectItem>
                <SelectItem value="foundation">Foundation</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="press">Press</SelectItem>
                <SelectItem value="corporation">Corporation</SelectItem>
                <SelectItem value="auction_house">Auction House</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Website</Label><Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>City</Label><Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} /></div>
            <div><Label>Country</Label><Input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createOrg.isPending}>Create</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
