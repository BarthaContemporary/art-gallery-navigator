import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCRMCampaign, useCRMLists } from "@/hooks/crm";
import { useState } from "react";

interface CampaignDialogProps { open: boolean; onOpenChange: (open: boolean) => void; }

export function CampaignDialog({ open, onOpenChange }: CampaignDialogProps) {
  const [formData, setFormData] = useState({ name: "", description: "", list_id: "", subject: "" });
  const { data: lists } = useCRMLists();
  const createCampaign = useCreateCRMCampaign();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCampaign.mutate(formData, { onSuccess: () => { onOpenChange(false); setFormData({ name: "", description: "", list_id: "", subject: "" }); } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Campaign</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Name *</Label><Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
          <div><Label>Subject</Label><Input value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} /></div>
          <div><Label>Audience List</Label>
            <Select value={formData.list_id} onValueChange={(v) => setFormData({ ...formData, list_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select a list" /></SelectTrigger>
              <SelectContent>{lists?.map((l) => <SelectItem key={l.id} value={l.id}>{l.name} ({l.member_count})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Description</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createCampaign.isPending}>Create</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
