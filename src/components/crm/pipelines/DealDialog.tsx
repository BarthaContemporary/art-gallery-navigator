import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useCreateCRMDeal, useUpdateCRMDeal, useCRMContacts, useCRMOrganizations, useCreateCRMContact } from "@/hooks/crm";
import { CRMPipelineStage, CRMDeal } from "@/types/crm";
import { useState, useEffect } from "react";
import { Building2, User, Percent, Check, ChevronsUpDown, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface DealDialogProps { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  pipelineId: string; 
  stages: CRMPipelineStage[]; 
  deal?: CRMDeal | null;
}

export function DealDialog({ open, onOpenChange, pipelineId, stages, deal }: DealDialogProps) {
  const navigate = useNavigate();
  const [contactSearch, setContactSearch] = useState("");
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
  const [newContactName, setNewContactName] = useState<string | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({ 
    name: "", 
    stage_id: "", 
    value: "", 
    currency: "GBP",
    organization_id: "",
    probability: 0,
    expected_close_date: "",
    notes: "",
  });
  
  const createDeal = useCreateCRMDeal();
  const updateDeal = useUpdateCRMDeal();
  const createContact = useCreateCRMContact();
  const { data: contactsResult } = useCRMContacts({ pageSize: 100 });
  const { data: organizations = [] } = useCRMOrganizations();

  useEffect(() => {
    if (deal) {
      setFormData({
        name: deal.name,
        stage_id: deal.stage_id || "",
        value: deal.value?.toString() || "",
        currency: deal.currency || "GBP",
        organization_id: deal.organization_id || "",
        probability: deal.probability || 0,
        expected_close_date: deal.expected_close_date || "",
        notes: deal.notes || "",
      });
      // Load existing contacts from deal
      const existingContactIds = deal.contacts?.map(dc => dc.contact_id) || 
        (deal.contact_id ? [deal.contact_id] : []);
      setSelectedContactIds(existingContactIds);
      setNewContactName(null);
      setContactSearch("");
    } else {
      setFormData({ name: "", stage_id: stages[0]?.id || "", value: "", currency: "GBP", organization_id: "", probability: 0, expected_close_date: "", notes: "" });
      setSelectedContactIds([]);
      setNewContactName(null);
      setContactSearch("");
    }
  }, [deal, stages, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let contactIds = [...selectedContactIds];
    let createdContactId: string | null = null;
    
    // If we have a new contact name, create the contact first
    if (newContactName) {
      try {
        const newContact = await createContact.mutateAsync({
          full_name: newContactName.trim(),
          contact_type: 'prospect',
          status: 'active',
        });
        contactIds.push(newContact.id);
        createdContactId = newContact.id;
      } catch (error) {
        toast.error("Failed to create contact");
        return;
      }
    }
    
    const data = {
      name: formData.name,
      pipeline_id: pipelineId,
      stage_id: formData.stage_id || stages[0]?.id,
      value: formData.value ? parseFloat(formData.value) : undefined,
      currency: formData.currency,
      contact_ids: contactIds,
      organization_id: formData.organization_id || undefined,
      probability: formData.probability,
      expected_close_date: formData.expected_close_date || undefined,
      notes: formData.notes || undefined,
    };

    const onSuccess = () => {
      onOpenChange(false);
      setFormData({ name: "", stage_id: "", value: "", currency: "GBP", organization_id: "", probability: 0, expected_close_date: "", notes: "" });
      setSelectedContactIds([]);
      setNewContactName(null);
      setContactSearch("");
      
      // If we created a new contact, prompt user to add more details
      if (createdContactId) {
        toast.success("Deal created! Would you like to add more details to the new contact?", {
          duration: 8000,
          action: {
            label: "Edit Contact",
            onClick: () => navigate(`/crm/contacts/${createdContactId}`),
          },
        });
      }
    };

    if (deal) {
      updateDeal.mutate({ id: deal.id, ...data }, { onSuccess: () => onOpenChange(false) });
    } else {
      createDeal.mutate(data, { onSuccess });
    }
  };

  const contacts = contactsResult?.contacts || [];
  
  // Filter contacts based on search, excluding already selected
  const filteredContacts = contacts.filter(c => 
    c.full_name.toLowerCase().includes(contactSearch.toLowerCase()) &&
    !selectedContactIds.includes(c.id)
  );
  
  // Check if search matches any existing contact
  const exactMatch = contacts.find(c => 
    c.full_name.toLowerCase() === contactSearch.toLowerCase()
  );
  
  const selectedContacts = contacts.filter(c => selectedContactIds.includes(c.id));

  const handleSelectContact = (contactId: string) => {
    if (!selectedContactIds.includes(contactId)) {
      setSelectedContactIds([...selectedContactIds, contactId]);
    }
    setContactSearch("");
    setContactPopoverOpen(false);
  };

  const handleRemoveContact = (contactId: string) => {
    setSelectedContactIds(selectedContactIds.filter(id => id !== contactId));
  };

  const handleCreateNewContact = () => {
    if (contactSearch.trim()) {
      setNewContactName(contactSearch.trim());
      setContactSearch("");
      setContactPopoverOpen(false);
    }
  };

  const handleClearNewContact = () => {
    setNewContactName(null);
  };

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

          <div>
            <Label className="flex items-center gap-2"><User className="h-3 w-3" />Contacts</Label>
            
            {/* Selected contacts badges */}
            {(selectedContacts.length > 0 || newContactName) && (
              <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
                {selectedContacts.map((contact) => (
                  <Badge key={contact.id} variant="secondary" className="gap-1 pr-1">
                    {contact.full_name}
                    <button
                      type="button"
                      onClick={() => handleRemoveContact(contact.id)}
                      className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {newContactName && (
                  <Badge variant="outline" className="gap-1 pr-1 border-primary text-primary">
                    <UserPlus className="h-3 w-3" />
                    {newContactName} (new)
                    <button
                      type="button"
                      onClick={handleClearNewContact}
                      className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}
            
            <Popover open={contactPopoverOpen} onOpenChange={setContactPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={contactPopoverOpen}
                  className="w-full justify-between font-normal"
                >
                  <span className="text-muted-foreground">Add contact...</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput 
                    placeholder="Type to search or add..." 
                    value={contactSearch}
                    onValueChange={setContactSearch}
                  />
                  <CommandList>
                    {filteredContacts.length === 0 && !contactSearch && (
                      <CommandEmpty>No more contacts to add.</CommandEmpty>
                    )}
                    
                    {/* Show option to create new contact if search doesn't match */}
                    {contactSearch.trim() && !exactMatch && (
                      <CommandGroup heading="Create new">
                        <CommandItem onSelect={handleCreateNewContact} className="text-primary">
                          <UserPlus className="mr-2 h-4 w-4" />
                          Add "{contactSearch.trim()}" as new contact
                        </CommandItem>
                      </CommandGroup>
                    )}
                    
                    {/* Existing contacts */}
                    {filteredContacts.length > 0 && (
                      <CommandGroup heading="Existing contacts">
                        {filteredContacts.map((contact) => (
                          <CommandItem
                            key={contact.id}
                            value={contact.id}
                            onSelect={() => handleSelectContact(contact.id)}
                          >
                            <Check className="mr-2 h-4 w-4 opacity-0" />
                            <div className="flex flex-col">
                              <span>{contact.full_name}</span>
                              {contact.email && (
                                <span className="text-xs text-muted-foreground">{contact.email}</span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div><Label className="flex items-center gap-2"><Building2 className="h-3 w-3" />Organisation</Label>
            <Select value={formData.organization_id || "none"} onValueChange={(v) => setFormData({ ...formData, organization_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Select organisation" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {organizations.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createDeal.isPending || updateDeal.isPending || createContact.isPending}>
              {deal ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
