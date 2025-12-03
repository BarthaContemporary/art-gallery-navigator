
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, Trash2, UserPlus } from "lucide-react";
import { ClientMultiSelect } from "./ClientMultiSelect";
import { useUpdateCollection } from "@/hooks/use-collections";
import { useClientListMembers, useUpdateClientList } from "@/hooks/use-client-lists";
import { useAddMultipleClientsToList, useRemoveMultipleClientsFromList } from "@/hooks/use-client-lists-bulk";
import { ClientList } from "@/hooks/use-client-lists";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EditClientListDialogProps {
  list: ClientList | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditClientListDialog({ list, open, onOpenChange }: EditClientListDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedNewClientIds, setSelectedNewClientIds] = useState<string[]>([]);
  const [selectedCurrentClientIds, setSelectedCurrentClientIds] = useState<string[]>([]);

  const { data: currentMembers } = useClientListMembers(list?.id);
  const updateList = useUpdateClientList();
  const addMultipleClients = useAddMultipleClientsToList();
  const removeMultipleClients = useRemoveMultipleClientsFromList();

  useEffect(() => {
    if (list) {
      setName(list.name);
      setDescription(list.description || "");
    }
  }, [list]);

  useEffect(() => {
    setSelectedNewClientIds([]);
    setSelectedCurrentClientIds([]);
  }, [open]);

  if (!list) return null;

  const currentClientIds = currentMembers?.map(member => member.client_id) || [];
  
  const handleUpdateDetails = () => {
    if (!name.trim()) return;

    updateList.mutate(
      { 
        id: list.id,
        name: name.trim(), 
        description: description.trim() || undefined 
      }
    );
  };

  const handleAddClients = () => {
    if (selectedNewClientIds.length === 0) return;

    addMultipleClients.mutate(
      { clientIds: selectedNewClientIds, listId: list.id },
      {
        onSuccess: () => {
          setSelectedNewClientIds([]);
        }
      }
    );
  };

  const handleRemoveClients = () => {
    if (selectedCurrentClientIds.length === 0) return;

    removeMultipleClients.mutate(
      { clientIds: selectedCurrentClientIds, listId: list.id },
      {
        onSuccess: () => {
          setSelectedCurrentClientIds([]);
        }
      }
    );
  };

  const handleCurrentClientToggle = (clientId: string) => {
    setSelectedCurrentClientIds(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'customer':
        return 'text-green-600 bg-green-50';
      case 'prospect':
        return 'text-yellow-600 bg-yellow-50';
      case 'inactive':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Client List</DialogTitle>
          <DialogDescription>
            Manage your client list details and members.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="details" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">List Details</TabsTrigger>
              <TabsTrigger value="current" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Current Members
                <Badge variant="secondary" className="ml-1">
                  {currentMembers?.length || 0}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="add" className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Add Members
                {selectedNewClientIds.length > 0 && (
                  <Badge className="ml-1">
                    {selectedNewClientIds.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">List Name</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="List name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description (Optional)</Label>
                <Textarea
                  id="edit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this list..."
                  rows={3}
                />
              </div>
              <Button 
                onClick={handleUpdateDetails}
                disabled={updateList.isPending || !name.trim()}
                className="w-full"
              >
                {updateList.isPending ? "Updating..." : "Update Details"}
              </Button>
            </TabsContent>
            
            <TabsContent value="current" className="flex-1 overflow-hidden mt-4">
              <div className="space-y-4 h-full flex flex-col">
                {selectedCurrentClientIds.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-muted">
                    <span className="text-sm text-muted-foreground">
                      {selectedCurrentClientIds.length} client{selectedCurrentClientIds.length === 1 ? '' : 's'} selected
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleRemoveClients}
                      disabled={removeMultipleClients.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove Selected
                    </Button>
                  </div>
                )}
                
                <ScrollArea className="flex-1 border">
                  <div className="p-4 space-y-2">
                    {(!currentMembers || currentMembers.length === 0) ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        No clients in this list yet
                      </div>
                    ) : (
                      currentMembers.map((member: any) => (
                        <div
                          key={member.client_id}
                          className="flex items-center space-x-3 p-2 hover:bg-muted/50 cursor-pointer"
                          onClick={() => handleCurrentClientToggle(member.client_id)}
                        >
                          <Checkbox
                            checked={selectedCurrentClientIds.includes(member.client_id)}
                            onChange={() => handleCurrentClientToggle(member.client_id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{member.clients?.full_name}</span>
                              <Badge className={`text-xs ${getStatusColor(member.clients?.status)}`}>
                                {member.clients?.status}
                              </Badge>
                            </div>
                            {member.clients?.email && (
                              <div className="text-sm text-muted-foreground truncate">
                                {member.clients.email}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
            
            <TabsContent value="add" className="flex-1 overflow-hidden mt-4">
              <div className="space-y-4 h-full flex flex-col">
                {selectedNewClientIds.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-muted">
                    <span className="text-sm text-muted-foreground">
                      {selectedNewClientIds.length} client{selectedNewClientIds.length === 1 ? '' : 's'} selected
                    </span>
                    <Button
                      onClick={handleAddClients}
                      disabled={addMultipleClients.isPending}
                      size="sm"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Selected
                    </Button>
                  </div>
                )}
                
                <div className="flex-1 overflow-hidden">
                  <ClientMultiSelect
                    selectedClientIds={selectedNewClientIds}
                    onSelectionChange={setSelectedNewClientIds}
                    excludeClientIds={currentClientIds}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
