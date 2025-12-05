import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCRMDeal } from "@/hooks/crm";
import { CRMPipelineStage } from "@/types/crm";
import { useState } from "react";

interface DealDialogProps { open: boolean; onOpenChange: (open: boolean) => void; pipelineId: string; stages: CRMPipelineStage[]; }

export function DealDialog({ open, onOpenChange, pipelineId, stages }: DealDialogProps) {
  const [formData, setFormData] = useState({ name: "", stage_id: "", value: "", currency: "GBP" });
  const createDeal = useCreateCRMDeal();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createDeal.mutate({ name: formData.name, pipeline_id: pipelineId, stage_id: formData.stage_id || stages[0]?.id, value: formData.value ? parseFloat(formData.value) : undefined, currency: formData.currency }, { onSuccess: () => { onOpenChange(false); setFormData({ name: "", stage_id: "", value: "", currency: "GBP" }); } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Deal</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Name *</Label><Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
          <div><Label>Stage</Label>
            <Select value={formData.stage_id} onValueChange={(v) => setFormData({ ...formData, stage_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
              <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Value</Label><Input type="number" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} /></div>
            <div><Label>Currency</Label><Input value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createDeal.isPending}>Create</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
