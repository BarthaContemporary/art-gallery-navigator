import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCRMOrganization, useUpdateCRMOrganization } from "@/hooks/crm";
import { CRMOrganization, CRMOrganizationType } from "@/types/crm";
import { useState, useEffect } from "react";
import { AddressInput } from "@/components/crm/form/AddressInput";
import { VatEoriInput } from "@/components/crm/form/VatEoriInput";
import { CompanyNumberInput } from "@/components/crm/form/CompanyNumberInput";

interface OrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization?: CRMOrganization | null;
}

const initialFormData = {
  name: "",
  type: "other" as CRMOrganizationType,
  website: "",
  email: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
  vat_number: "",
  eori_number: "",
  company_number: "",
  notes: "",
};

export function OrganizationDialog({ open, onOpenChange, organization }: OrganizationDialogProps) {
  const [formData, setFormData] = useState(initialFormData);
  const createOrg = useCreateCRMOrganization();
  const updateOrg = useUpdateCRMOrganization();
  
  const isEditing = !!organization;

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || "",
        type: organization.type || "other",
        website: organization.website || "",
        email: organization.email || "",
        phone: organization.phone || "",
        address_line1: organization.address_line1 || "",
        address_line2: organization.address_line2 || "",
        city: organization.city || "",
        state: organization.state || "",
        postal_code: organization.postal_code || "",
        country: organization.country || "",
        vat_number: organization.vat_number || "",
        eori_number: organization.eori_number || "",
        company_number: organization.company_number || "",
        notes: organization.notes || "",
      });
    } else {
      setFormData(initialFormData);
    }
  }, [organization, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isEditing && organization) {
      updateOrg.mutate(
        { id: organization.id, ...formData },
        {
          onSuccess: () => {
            onOpenChange(false);
          },
        }
      );
    } else {
      createOrg.mutate(formData, {
        onSuccess: () => {
          onOpenChange(false);
          setFormData(initialFormData);
        },
      });
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
          <DialogTitle>{isEditing ? "Edit Organization" : "New Organization"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Name *</Label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label>Type</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as CRMOrganizationType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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

            <div>
              <Label>Website</Label>
              <Input
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://"
              />
            </div>

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
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

            {/* Company & Tax Section */}
            <div className="col-span-2 border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Company & Tax Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <CompanyNumberInput
                  value={formData.company_number}
                  onChange={(value) => setFormData({ ...formData, company_number: value })}
                />
                <VatEoriInput
                  type="vat"
                  value={formData.vat_number}
                  onChange={(value) => setFormData({ ...formData, vat_number: value })}
                />
                <VatEoriInput
                  type="eori"
                  value={formData.eori_number}
                  onChange={(value) => setFormData({ ...formData, eori_number: value })}
                />
              </div>
            </div>

            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createOrg.isPending || updateOrg.isPending}>
              {isEditing ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
