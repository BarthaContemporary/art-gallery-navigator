import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Download, Trash2 } from "lucide-react";
import { useCRMContacts, useBulkDeleteCRMContacts } from "@/hooks/crm";
import { ContactsTable } from "@/components/crm/contacts/ContactsTable";
import { ContactFilters } from "@/components/crm/contacts/ContactFilters";
import { ContactDialog } from "@/components/crm/contacts/ContactDialog";
import { ExportDialog } from "@/components/crm/export/ExportDialog";
import { AddToListDialog } from "@/components/crm/lists/AddToListDialog";
import { CRMContactType } from "@/types/crm";

export default function ContactsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [contactType, setContactType] = useState<CRMContactType | "all">("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isAddToListDialogOpen, setIsAddToListDialogOpen] = useState(false);

  const { data: contacts, isLoading } = useCRMContacts({
    searchTerm,
    contactType,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
  });

  const bulkDelete = useBulkDeleteCRMContacts();

  const handleBulkDelete = () => {
    if (selectedContacts.length > 0 && confirm(`Delete ${selectedContacts.length} contacts?`)) {
      bulkDelete.mutate(selectedContacts, {
        onSuccess: () => setSelectedContacts([]),
      });
    }
  };

  const selectedContactsData = contacts?.filter(c => selectedContacts.includes(c.id)) || [];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-muted-foreground text-sm">
            {contacts?.length || 0} contacts
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Contact
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <ContactFilters
          contactType={contactType}
          onContactTypeChange={setContactType}
          selectedTags={selectedTags}
          onTagsChange={setSelectedTags}
        />
      </div>

      {/* Bulk Actions */}
      {selectedContacts.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 border">
          <span className="text-sm font-medium">
            {selectedContacts.length} selected
          </span>
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddToListDialogOpen(true)}
            >
              Add to List
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExportDialogOpen(true)}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedContacts([])}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Contacts Table */}
      <ContactsTable
        contacts={contacts || []}
        isLoading={isLoading}
        selectedContacts={selectedContacts}
        onSelectionChange={setSelectedContacts}
      />

      {/* Dialogs */}
      <ContactDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        contacts={selectedContactsData}
        sourceType="contacts"
        sourceName="Selected Contacts"
      />

      <AddToListDialog
        open={isAddToListDialogOpen}
        onOpenChange={setIsAddToListDialogOpen}
        contactIds={selectedContacts}
        onSuccess={() => setSelectedContacts([])}
      />
    </div>
  );
}
