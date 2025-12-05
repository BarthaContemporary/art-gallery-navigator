import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCRMLists, useAddContactsToList } from "@/hooks/crm";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AddToListDialogProps { open: boolean; onOpenChange: (open: boolean) => void; contactIds: string[]; onSuccess?: () => void; }

export function AddToListDialog({ open, onOpenChange, contactIds, onSuccess }: AddToListDialogProps) {
  const [selectedList, setSelectedList] = useState("");
  const { data: lists } = useCRMLists({ type: "static" });
  const addToList = useAddContactsToList();

  const handleSubmit = () => {
    if (!selectedList) return;
    addToList.mutate({ listId: selectedList, contactIds }, { onSuccess: () => { onOpenChange(false); setSelectedList(""); onSuccess?.(); } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add to List</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Add {contactIds.length} contact(s) to a list</p>
          <Select value={selectedList} onValueChange={setSelectedList}>
            <SelectTrigger><SelectValue placeholder="Select a list" /></SelectTrigger>
            <SelectContent>{lists?.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!selectedList || addToList.isPending}>Add</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
