import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateCRMList } from "@/hooks/crm";
import { CRMListType } from "@/types/crm";
import { useState, useEffect } from "react";

interface ListDialogProps { open: boolean; onOpenChange: (open: boolean) => void; defaultType?: CRMListType; }

export function ListDialog({ open, onOpenChange, defaultType = "static" }: ListDialogProps) {
  const [formData, setFormData] = useState({ name: "", description: "", type: defaultType });
  const createList = useCreateCRMList();

  useEffect(() => { setFormData(f => ({ ...f, type: defaultType })); }, [defaultType, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createList.mutate(formData, { onSuccess: () => { onOpenChange(false); setFormData({ name: "", description: "", type: defaultType }); } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New {formData.type === "static" ? "List" : "Segment"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Name *</Label><Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
          {formData.type === "dynamic" && <p className="text-sm text-muted-foreground">Dynamic segment filters coming soon.</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createList.isPending}>Create</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
