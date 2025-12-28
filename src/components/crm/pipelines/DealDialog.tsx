import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useCreateCRMDeal, useUpdateCRMDeal, useCRMContacts, useCRMOrganizations } from "@/hooks/crm";
import { CRMPipelineStage, CRMDeal } from "@/types/crm";
import { useState, useEffect } from "react";
import { Building2, User, Percent } from "lucide-react";

interface DealDialogProps { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  pipelineId: string; 
  stages: CRMPipelineStage[]; 
  deal?: CRMDeal | null;
}

export function DealDialog({ open, onOpenChange, pipelineId, stages, deal }: DealDialogProps) {
  const [formData, setFormData] = useState({ 
    name: "", 
    stage_id: "", 
    value: "", 
    currency: "GBP",
    contact_id: "",
    organization_id: "",
    probability: 0,
    expected_close_date: "",
    notes: "",
  });
  
  const createDeal = useCreateCRMDeal();
  const updateDeal = useUpdateCRMDeal();
  const { data: contactsResult } = useCRMContacts({ pageSize: 100 });
  const { data: organizations = [] } = useCRMOrganizations();

  useEffect(() => {
    if (deal) {
      setFormData({
        name: deal.name,
        stage_id: deal.stage_id || "",
        value: deal.value?.toString() || "",
        currency: deal.currency || "GBP",
        contact_id: deal.contact_id || "",
        organization_id: deal.organization_id || "",
        probability: deal.probability || 0,
        expected_close_date: deal.expected_close_date || "",
        notes: deal.notes || "",
      });
    } else {
      setFormData({ name: "", stage_id: stages[0]?.id || "", value: "", currency: "GBP", contact_id: "", organization_id: "", probability: 0, expected_close_date: "", notes: "" });
    }
  }, [deal, stages, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      pipeline_id: pipelineId,
      stage_id: formData.stage_id || stages[0]?.id,
      value: formData.value ? parseFloat(formData.value) : undefined,
      currency: formData.currency,
      contact_id: formData.contact_id || undefined,
      organization_id: formData.organization_id || undefined,
      probability: formData.probability,
      expected_close_date: formData.expected_close_date || undefined,
      notes: formData.notes || undefined,
    };

    if (deal) {
      updateDeal.mutate({ id: deal.id, ...data }, { onSuccess: () => onOpenChange(false) });
    } else {
      createDeal.mutate(data, { onSuccess: () => { onOpenChange(false); setFormData({ name: "", stage_id: "", value: "", currency: "GBP", contact_id: "", organization_id: "", probability: 0, expected_close_date: "", notes: "" }); } });
    }
  };

  const contacts = contactsResult?.contacts || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{deal ? "Edit Deal" : "New Deal"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Name *</Label><Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
          
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Stage</Label>
              <Select value={formData.stage_id} onValueChange={(v) => setFormData({ ...formData, stage_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Expected Close</Label>
              <Input type="date" value={formData.expected_close_date} onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><Label>Value</Label><Input type="number" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} /></div>
            <div><Label>Currency</Label><Input value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} /></div>
          </div>

          <div>
            <Label className="flex items-center gap-2"><Percent className="h-3 w-3" />Probability: {formData.probability}%</Label>
            <Slider value={[formData.probability]} onValueChange={([v]) => setFormData({ ...formData, probability: v })} max={100} step={5} className="mt-2" />
          </div>

          <div><Label className="flex items-center gap-2"><User className="h-3 w-3" />Contact</Label>
            <Select value={formData.contact_id || "none"} onValueChange={(v) => setFormData({ ...formData, contact_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div><Label className="flex items-center gap-2"><Building2 className="h-3 w-3" />Organization</Label>
            <Select value={formData.organization_id || "none"} onValueChange={(v) => setFormData({ ...formData, organization_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {organizations.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createDeal.isPending || updateDeal.isPending}>{deal ? "Save" : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
