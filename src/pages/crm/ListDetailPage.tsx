import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCRMList, useCRMListMembers, useRemoveContactFromList, useAddContactsToList, useCRMContacts } from "@/hooks/crm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Trash2, Download, Users, Filter, Building2, Mail, FileText } from "lucide-react";
import { toast } from "sonner";
import { ListExportDialog } from "@/components/crm/lists/ListExportDialog";

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactsToAdd, setSelectedContactsToAdd] = useState<string[]>([]);

  const { data: list, isLoading: listLoading } = useCRMList(id);
  const { data: members, isLoading: membersLoading } = useCRMListMembers(id);
  const { data: contactsResult } = useCRMContacts({ searchTerm: contactSearch, pageSize: 50 });
  const removeContact = useRemoveContactFromList();
  const addContacts = useAddContactsToList();

  const handleRemoveSelected = async () => {
    if (!id || selectedMembers.length === 0) return;
    const promises = selectedMembers.map(memberId => 
      removeContact.mutateAsync({ listId: id, contactId: memberId })
    );
    await Promise.all(promises);
    setSelectedMembers([]);
    toast.success(`Removed ${selectedMembers.length} contacts from list`);
  };

  const handleAddContacts = async () => {
    if (!id || selectedContactsToAdd.length === 0) return;
    await addContacts.mutateAsync({ listId: id, contactIds: selectedContactsToAdd });
    setSelectedContactsToAdd([]);
    setIsAddDialogOpen(false);
    toast.success(`Added ${selectedContactsToAdd.length} contacts to list`);
  };

  const toggleMember = (contactId: string) => {
    setSelectedMembers(prev => 
      prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]
    );
  };

  const toggleAllMembers = () => {
    if (selectedMembers.length === members?.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(members?.map(m => m.contact_id) || []);
    }
  };

  // Filter out contacts already in the list
  const memberContactIds = new Set(members?.map(m => m.contact_id) || []);
  const availableContacts = contactsResult?.contacts.filter(c => !memberContactIds.has(c.id)) || [];

  if (listLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">List not found</p>
        <Button variant="outline" onClick={() => navigate("/crm/lists")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Lists
        </Button>
      </div>
    );
  }

  const memberContacts = members?.map(m => m.contact).filter(Boolean) || [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/crm/lists")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{list.name}</h1>
              <Badge variant={list.type === "static" ? "secondary" : "outline"}>
                {list.type === "static" ? <Users className="h-3 w-3 mr-1" /> : <Filter className="h-3 w-3 mr-1" />}
                {list.type}
              </Badge>
            </div>
            {list.description && (
              <p className="text-sm text-muted-foreground mt-1">{list.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsExportOpen(true)}>
            <Download className="h-4 w-4 mr-2" />Export
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />Add Contacts
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Contacts to List</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input 
                  placeholder="Search contacts..." 
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                />
                <div className="max-h-72 overflow-y-auto space-y-2">
                  {availableContacts.map(contact => (
                    <div 
                      key={contact.id} 
                      className="flex items-center gap-3 p-2 rounded border hover:bg-muted/50 cursor-pointer"
                      onClick={() => setSelectedContactsToAdd(prev => 
                        prev.includes(contact.id) ? prev.filter(id => id !== contact.id) : [...prev, contact.id]
                      )}
                    >
                      <Checkbox checked={selectedContactsToAdd.includes(contact.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{contact.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{contact.email || "No email"}</p>
                      </div>
                      {contact.organization && (
                        <Badge variant="outline" className="text-xs">
                          <Building2 className="h-2.5 w-2.5 mr-1" />
                          {contact.organization.name}
                        </Badge>
                      )}
                    </div>
                  ))}
                  {availableContacts.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No contacts available</p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddContacts} disabled={selectedContactsToAdd.length === 0 || addContacts.isPending}>
                    Add {selectedContactsToAdd.length} Contact{selectedContactsToAdd.length !== 1 ? 's' : ''}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <Card>
        <CardContent className="py-4">
          <div className="flex gap-8">
            <div>
              <p className="text-2xl font-bold">{list.member_count || 0}</p>
              <p className="text-sm text-muted-foreground">Total Contacts</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{memberContacts.filter(c => c?.email).length}</p>
              <p className="text-sm text-muted-foreground">With Email</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedMembers.length > 0 && (
        <div className="flex gap-2 p-3 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground self-center">{selectedMembers.length} selected</span>
          <Button variant="destructive" size="sm" onClick={handleRemoveSelected}>
            <Trash2 className="h-4 w-4 mr-2" />Remove from List
          </Button>
        </div>
      )}

      {/* Members Table */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">List Members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {membersLoading ? (
            <div className="space-y-2 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : members?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No contacts in this list yet</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />Add Contacts
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectedMembers.length === members?.length && members.length > 0} 
                      onCheckedChange={toggleAllMembers} 
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members?.map((member) => (
                  <TableRow 
                    key={member.id} 
                    className="cursor-pointer"
                    onClick={() => navigate(`/crm/contacts/${member.contact_id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox 
                        checked={selectedMembers.includes(member.contact_id)} 
                        onCheckedChange={() => toggleMember(member.contact_id)} 
                      />
                    </TableCell>
                    <TableCell className="font-medium">{member.contact?.full_name}</TableCell>
                    <TableCell>{member.contact?.email || "-"}</TableCell>
                    <TableCell>
                      {member.contact?.organization ? (
                        <Badge variant="outline" className="text-xs">
                          <Building2 className="h-2.5 w-2.5 mr-1" />
                          {member.contact.organization.name}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{member.contact?.contact_type}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <ListExportDialog 
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        list={list}
        contacts={memberContacts}
      />
    </div>
  );
}
