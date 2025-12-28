import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useDealInteractions, useCreateDealInteraction, useDeleteDealInteraction } from "@/hooks/crm/use-crm-deal-interactions";
import { useCRMContacts } from "@/hooks/crm";
import { CRMDealInteractionType, CRMInteractionDirection } from "@/types/crm";
import { Plus, Mail, Phone, Calendar, FileText, Trash2, User, ArrowDownLeft, ArrowUpRight, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface DealInteractionsTimelineProps {
  dealId: string;
}

const typeIcons: Record<CRMDealInteractionType, React.ReactNode> = {
  email: <Mail className="h-3.5 w-3.5" />,
  call: <Phone className="h-3.5 w-3.5" />,
  meeting: <Calendar className="h-3.5 w-3.5" />,
  note: <FileText className="h-3.5 w-3.5" />,
  other: <MessageSquare className="h-3.5 w-3.5" />,
};

const typeLabels: Record<CRMDealInteractionType, string> = {
  email: "Email",
  call: "Call",
  meeting: "Meeting",
  note: "Note",
  other: "Other",
};

export function DealInteractionsTimeline({ dealId }: DealInteractionsTimelineProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: "note" as CRMDealInteractionType,
    direction: "" as CRMInteractionDirection | "",
    subject: "",
    summary: "",
    contact_id: "",
  });

  const { data: interactions = [], isLoading } = useDealInteractions(dealId);
  const createInteraction = useCreateDealInteraction();
  const deleteInteraction = useDeleteDealInteraction();
  const { data: contactsResult } = useCRMContacts({ pageSize: 100 });
  const contacts = contactsResult?.contacts || [];

  const handleCreate = () => {
    createInteraction.mutate(
      {
        deal_id: dealId,
        type: formData.type,
        direction: formData.direction || undefined,
        subject: formData.subject || undefined,
        summary: formData.summary || undefined,
        contact_id: formData.contact_id || undefined,
      },
      {
        onSuccess: () => {
          setIsAddDialogOpen(false);
          setFormData({ type: "note", direction: "", subject: "", summary: "", contact_id: "" });
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this interaction?")) return;
    deleteInteraction.mutate({ id, deal_id: dealId });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Interactions</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Log
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : interactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No interactions logged yet</p>
      ) : (
        <div className="space-y-3">
          {interactions.map((interaction) => (
            <div 
              key={interaction.id} 
              className="flex gap-3 p-3 border rounded-lg group hover:bg-muted/50 transition-colors"
            >
              <div className="shrink-0 mt-0.5">
                <div className="p-1.5 bg-muted rounded-full">
                  {typeIcons[interaction.type]}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {typeLabels[interaction.type]}
                  </Badge>
                  {interaction.direction && (
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                      {interaction.direction === 'inbound' ? (
                        <ArrowDownLeft className="h-3 w-3" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3" />
                      )}
                      {interaction.direction}
                    </span>
                  )}
                  {interaction.contact && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      {interaction.contact.full_name}
                    </span>
                  )}
                </div>
                {interaction.subject && (
                  <p className="font-medium text-sm mt-1">{interaction.subject}</p>
                )}
                {interaction.summary && (
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                    {interaction.summary}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {format(new Date(interaction.interaction_date), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-destructive"
                onClick={() => handleDelete(interaction.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Interaction Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Interaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(v) => setFormData({ ...formData, type: v as CRMDealInteractionType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Direction</Label>
                <Select 
                  value={formData.direction || "none"} 
                  onValueChange={(v) => setFormData({ ...formData, direction: v === "none" ? "" : v as CRMInteractionDirection })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Contact (optional)</Label>
              <Select 
                value={formData.contact_id || "none"} 
                onValueChange={(v) => setFormData({ ...formData, contact_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Subject</Label>
              <Input 
                value={formData.subject} 
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Brief subject or title"
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea 
                value={formData.summary} 
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                placeholder="Details about the interaction..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createInteraction.isPending}>
              Log Interaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
