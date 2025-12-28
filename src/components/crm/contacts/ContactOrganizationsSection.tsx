import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Trash2, Star, StarOff } from "lucide-react";
import { 
  useContactOrganizations, 
  useAddContactOrganization, 
  useRemoveContactOrganization,
  useUpdateContactOrganization,
  useCRMOrganizations 
} from "@/hooks/crm";

interface ContactOrganizationsSectionProps {
  contactId: string;
}

export function ContactOrganizationsSection({ contactId }: ContactOrganizationsSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [role, setRole] = useState("");

  const { data: contactOrgs = [], isLoading } = useContactOrganizations(contactId);
  const { data: allOrganizations = [] } = useCRMOrganizations();
  const addOrg = useAddContactOrganization();
  const removeOrg = useRemoveContactOrganization();
  const updateOrg = useUpdateContactOrganization();

  // Filter out already-linked organizations
  const availableOrgs = allOrganizations.filter(
    org => !contactOrgs.some(co => co.organization_id === org.id)
  );

  const handleAdd = () => {
    if (!selectedOrgId) return;
    addOrg.mutate(
      { contact_id: contactId, organization_id: selectedOrgId, role: role || undefined },
      { 
        onSuccess: () => {
          setIsAddDialogOpen(false);
          setSelectedOrgId("");
          setRole("");
        }
      }
    );
  };

  const handleRemove = (id: string, organizationId: string) => {
    if (!confirm("Remove this organization?")) return;
    removeOrg.mutate({ id, contact_id: contactId, organization_id: organizationId });
  };

  const handleSetPrimary = (id: string, organizationId: string, currentPrimary: boolean) => {
    updateOrg.mutate({ 
      id, 
      contact_id: contactId, 
      organization_id: organizationId, 
      is_primary: !currentPrimary 
    });
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading organizations...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Organizations</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {contactOrgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No organizations linked</p>
        ) : (
          contactOrgs.map((co) => (
            <div 
              key={co.id} 
              className="flex items-center justify-between p-2 border rounded-lg group"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {co.organization?.name}
                  </p>
                  {co.role && (
                    <p className="text-xs text-muted-foreground">{co.role}</p>
                  )}
                </div>
                {co.is_primary && (
                  <Badge variant="secondary" className="text-xs shrink-0">Primary</Badge>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleSetPrimary(co.id, co.organization_id, co.is_primary)}
                  title={co.is_primary ? "Unset primary" : "Set as primary"}
                >
                  {co.is_primary ? (
                    <StarOff className="h-3.5 w-3.5" />
                  ) : (
                    <Star className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => handleRemove(co.id, co.organization_id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      {/* Add Organization Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Organization</Label>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {availableOrgs.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      <span className="flex items-center gap-2">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        {org.name}
                      </span>
                    </SelectItem>
                  ))}
                  {availableOrgs.length === 0 && (
                    <div className="py-2 px-2 text-sm text-muted-foreground">
                      No organizations available
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Role (optional)</Label>
              <Input 
                placeholder="e.g., Advisor, Board Member" 
                value={role} 
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!selectedOrgId || addOrg.isPending}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
