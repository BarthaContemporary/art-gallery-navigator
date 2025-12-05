import { useCRMInteractions, useCreateCRMInteraction } from "@/hooks/crm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, Phone, MessageCircle, StickyNote } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { CRMInteractionType } from "@/types/crm";

const iconMap: Record<CRMInteractionType, typeof Mail> = { email: Mail, call: Phone, meeting: MessageCircle, instagram_dm: MessageCircle, whatsapp: MessageCircle, wechat: MessageCircle, line: MessageCircle, note: StickyNote, task: StickyNote, other: StickyNote };

interface ContactTimelineProps { contactId: string; }

export function ContactTimeline({ contactId }: ContactTimelineProps) {
  const { data: interactions, isLoading } = useCRMInteractions({ contactId });
  const createInteraction = useCreateCRMInteraction();
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    createInteraction.mutate({ contact_id: contactId, type: "note", notes: newNote, interaction_date: new Date().toISOString() }, {
      onSuccess: () => { setNewNote(""); setIsAddingNote(false); }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Activity Timeline</h3>
        <Button size="sm" variant="outline" onClick={() => setIsAddingNote(true)}><Plus className="h-4 w-4 mr-1" />Add Note</Button>
      </div>

      {isAddingNote && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Textarea placeholder="Add a note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setIsAddingNote(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAddNote} disabled={createInteraction.isPending}>Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : interactions?.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No interactions yet</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {interactions?.map((interaction) => {
            const Icon = iconMap[interaction.type] || StickyNote;
            return (
              <Card key={interaction.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted"><Icon className="h-4 w-4" /></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{interaction.type}</Badge>
                        <span className="text-xs text-muted-foreground">{format(new Date(interaction.interaction_date), "MMM d, yyyy h:mm a")}</span>
                      </div>
                      {interaction.subject && <p className="font-medium mt-1">{interaction.subject}</p>}
                      {interaction.notes && <p className="text-sm text-muted-foreground mt-1">{interaction.notes}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
