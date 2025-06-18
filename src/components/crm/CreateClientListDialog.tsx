
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Users } from "lucide-react";
import { ClientMultiSelect } from "./ClientMultiSelect";
import { useCreateClientListWithMembers } from "@/hooks/use-client-lists-bulk";

export function CreateClientListDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const createListWithMembers = useCreateClientListWithMembers();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createListWithMembers.mutate(
      { 
        name: name.trim(), 
        description: description.trim() || undefined,
        clientIds: selectedClientIds
      },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setDescription("");
          setSelectedClientIds([]);
        }
      }
    );
  };

  const handleClose = () => {
    setOpen(false);
    setName("");
    setDescription("");
    setSelectedClientIds([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          New List
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle>Create Client List</DialogTitle>
            <DialogDescription>
              Create a new list and optionally add clients to it.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="details" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">List Details</TabsTrigger>
                <TabsTrigger value="clients" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Add Clients
                  {selectedClientIds.length > 0 && (
                    <span className="ml-1 bg-primary text-primary-foreground rounded-full text-xs px-1.5 py-0.5 min-w-[1.25rem] h-5 flex items-center justify-center">
                      {selectedClientIds.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">List Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., VIP Collectors, Newsletter Subscribers"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of this list..."
                    rows={3}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="clients" className="flex-1 overflow-hidden mt-4">
                <div className="h-full">
                  <ClientMultiSelect
                    selectedClientIds={selectedClientIds}
                    onSelectionChange={setSelectedClientIds}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createListWithMembers.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createListWithMembers.isPending || !name.trim()}
            >
              {createListWithMembers.isPending ? "Creating..." : "Create List"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
