import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Search, Download, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useCRMContacts, useBulkDeleteCRMContacts } from "@/hooks/crm";
import { ContactsTable } from "@/components/crm/contacts/ContactsTable";
import { ContactFilters } from "@/components/crm/contacts/ContactFilters";
import { ContactDialog } from "@/components/crm/contacts/ContactDialog";
import { ExportDialog } from "@/components/crm/export/ExportDialog";
import { AddToListDialog } from "@/components/crm/lists/AddToListDialog";
import { CRMContactType } from "@/types/crm";

const PAGE_SIZE = 100;

export default function ContactsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [contactType, setContactType] = useState<CRMContactType | "all">("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isAddToListDialogOpen, setIsAddToListDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useCRMContacts({
    searchTerm,
    contactType,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const contacts = data?.contacts || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const bulkDelete = useBulkDeleteCRMContacts();

  const handleBulkDelete = () => {
    if (selectedContacts.length > 0 && confirm(`Delete ${selectedContacts.length} contacts?`)) {
      bulkDelete.mutate(selectedContacts, {
        onSuccess: () => setSelectedContacts([]),
      });
    }
  };

  const selectedContactsData = contacts?.filter(c => selectedContacts.includes(c.id)) || [];

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const handleContactTypeChange = (value: CRMContactType | "all") => {
    setContactType(value);
    setPage(1);
  };

  const handleTagsChange = (value: string[]) => {
    setSelectedTags(value);
    setPage(1);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col items-start gap-1">
        <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Contact
        </Button>
        <p className="text-muted-foreground text-xs">
          {totalCount.toLocaleString()} contacts
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <ContactFilters
          contactType={contactType}
          onContactTypeChange={handleContactTypeChange}
          selectedTags={selectedTags}
          onTagsChange={handleTagsChange}
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
        contacts={contacts}
        isLoading={isLoading}
        selectedContacts={selectedContacts}
        onSelectionChange={setSelectedContacts}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

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
