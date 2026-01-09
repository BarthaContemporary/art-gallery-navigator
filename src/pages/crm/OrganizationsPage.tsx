import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Search, Building2 } from "lucide-react";
import { useCRMOrganizations } from "@/hooks/crm";
import { OrganizationDialog } from "@/components/crm/organizations/OrganizationDialog";
import { OrganizationsTable } from "@/components/crm/organizations/OrganizationsTable";
import { CRMOrganization, CRMOrganizationType } from "@/types/crm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const organizationTypes: { value: CRMOrganizationType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'museum', label: 'Museum' },
  { value: 'foundation', label: 'Foundation' },
  { value: 'fair', label: 'Fair' },
  { value: 'press', label: 'Press' },
  { value: 'corporation', label: 'Corporation' },
  { value: 'auction_house', label: 'Auction House' },
  { value: 'interior_designer', label: 'Interior Designer' },
  { value: 'other', label: 'Other' },
];

export default function OrganizationsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [type, setType] = useState<CRMOrganizationType | "all">("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState<CRMOrganization | null>(null);

  const { data: organizations, isLoading } = useCRMOrganizations({
    searchTerm,
    type,
  });

  const handleRowClick = (org: CRMOrganization) => {
    setSelectedOrganization(org);
    setIsDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setSelectedOrganization(null);
    }
  };

  const handleAddNew = () => {
    setSelectedOrganization(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col items-start gap-1">
        <Button onClick={handleAddNew} size="sm">
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Organisation
        </Button>
        <p className="text-muted-foreground text-xs">
          {organizations?.length || 0} organisations
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search organisations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={type} onValueChange={(v) => setType(v as CRMOrganizationType | "all")}>
          <SelectTrigger className="w-48">
            <Building2 className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {organizationTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Organizations Table */}
      <OrganizationsTable
        organizations={organizations || []}
        isLoading={isLoading}
        onRowClick={handleRowClick}
      />

      {/* Dialog */}
      <OrganizationDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        organization={selectedOrganization}
      />
    </div>
  );
}
