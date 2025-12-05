import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Loader2, Search, User, Mail, Building2 } from "lucide-react";

interface GoogleContact {
  google_contact_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  organization_name: string | null;
  job_title: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fetchContacts: () => Promise<GoogleContact[]>;
  importContacts: (contacts: GoogleContact[]) => Promise<{ imported: number; skipped: number }>;
}

export function GoogleContactsImportDialog({ 
  open, 
  onOpenChange, 
  fetchContacts, 
  importContacts 
}: Props) {
  const [contacts, setContacts] = useState<GoogleContact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const handleFetch = async () => {
    setIsLoading(true);
    try {
      const result = await fetchContacts();
      setContacts(result);
      setHasFetched(true);
      // Select all by default
      setSelectedIds(new Set(result.map(c => c.google_contact_id)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    const selectedContacts = contacts.filter(c => selectedIds.has(c.google_contact_id));
    if (selectedContacts.length === 0) return;

    setIsImporting(true);
    try {
      await importContacts(selectedContacts);
      onOpenChange(false);
      // Reset state
      setContacts([]);
      setSelectedIds(new Set());
      setHasFetched(false);
    } finally {
      setIsImporting(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map(c => c.google_contact_id)));
    }
  };

  const filteredContacts = contacts.filter(c => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      c.full_name?.toLowerCase().includes(searchLower) ||
      c.email?.toLowerCase().includes(searchLower) ||
      c.organization_name?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Google Contacts</DialogTitle>
          <DialogDescription>
            Select contacts to import into your CRM
          </DialogDescription>
        </DialogHeader>

        {!hasFetched ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              Fetch your Google contacts to begin importing
            </p>
            <Button onClick={handleFetch} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Fetching...
                </>
              ) : (
                'Fetch Contacts'
              )}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                {selectedIds.size === filteredContacts.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <ScrollArea className="h-[400px] border">
              {filteredContacts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No contacts found
                </div>
              ) : (
                <div className="divide-y">
                  {filteredContacts.map((contact) => (
                    <label
                      key={contact.google_contact_id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedIds.has(contact.google_contact_id)}
                        onCheckedChange={() => toggleSelect(contact.google_contact_id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{contact.full_name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-0.5">
                          {contact.email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </span>
                          )}
                          {contact.organization_name && (
                            <span className="flex items-center gap-1 truncate">
                              <Building2 className="h-3 w-3" />
                              {contact.organization_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedIds.size} of {filteredContacts.length} selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={selectedIds.size === 0 || isImporting}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import ${selectedIds.size} Contacts`
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
