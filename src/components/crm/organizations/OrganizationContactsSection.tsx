import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Plus, Trash2, Star, StarOff, Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { 
  useOrganizationContacts, 
  useAddContactOrganization, 
  useRemoveContactOrganization,
  useUpdateContactOrganization,
  useCRMContacts 
} from "@/hooks/crm";

interface OrganizationContactsSectionProps {
  organizationId: string;
}

export function OrganizationContactsSection({ organizationId }: OrganizationContactsSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [role, setRole] = useState("");

  const { data: orgContacts = [], isLoading } = useOrganizationContacts(organizationId);
  const { data: contactsResult } = useCRMContacts({ pageSize: 200 });
  const allContacts = contactsResult?.contacts || [];
  const addOrg = useAddContactOrganization();
  const removeOrg = useRemoveContactOrganization();
  const updateOrg = useUpdateContactOrganization();

  // Filter out already-linked contacts
  const availableContacts = allContacts.filter(
    c => !orgContacts.some(oc => oc.contact_id === c.id)
  );

  const handleAdd = () => {
    if (!selectedContactId) return;
    addOrg.mutate(
      { contact_id: selectedContactId, organization_id: organizationId, role: role || undefined },
      { 
        onSuccess: () => {
          setIsAddDialogOpen(false);
          setSelectedContactId("");
          setRole("");
        }
      }
    );
  };

  const handleRemove = (id: string, contactId: string) => {
    if (!confirm("Remove this contact from the organization?")) return;
    removeOrg.mutate({ id, contact_id: contactId, organization_id: organizationId });
  };

  const handleSetPrimary = (id: string, contactId: string, currentPrimary: boolean) => {
    updateOrg.mutate({ 
      id, 
      contact_id: contactId, 
      organization_id: organizationId, 
      is_primary: !currentPrimary 
    });
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading contacts...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Contacts ({orgContacts.length})</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {orgContacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contacts linked</p>
        ) : (
          orgContacts.map((oc) => (
            <div 
              key={oc.id} 
              className="flex items-center justify-between p-2 border rounded-lg group hover:bg-muted/50 transition-colors"
            >
              <Link 
                to={`/crm/contacts/${oc.contact_id}`}
                className="flex items-center gap-2 min-w-0 flex-1"
              >
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate hover:underline">
                    {oc.contact?.full_name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {oc.role && <span>{oc.role}</span>}
                    {oc.contact?.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {oc.contact.email}
                      </span>
                    )}
                  </div>
                </div>
                {oc.is_primary && (
                  <Badge variant="secondary" className="text-xs shrink-0">Primary</Badge>
                )}
              </Link>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.preventDefault();
                    handleSetPrimary(oc.id, oc.contact_id, oc.is_primary);
                  }}
                  title={oc.is_primary ? "Unset primary" : "Set as primary"}
                >
                  {oc.is_primary ? (
                    <StarOff className="h-3.5 w-3.5" />
                  ) : (
                    <Star className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    handleRemove(oc.id, oc.contact_id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      {/* Add Contact Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Contact</Label>
              <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  {availableContacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      <span className="flex items-center gap-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {contact.full_name}
                      </span>
                    </SelectItem>
                  ))}
                  {availableContacts.length === 0 && (
                    <div className="py-2 px-2 text-sm text-muted-foreground">
                      No contacts available
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Role (optional)</Label>
              <Input 
                placeholder="e.g., Director, Curator" 
                value={role} 
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!selectedContactId || addOrg.isPending}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
