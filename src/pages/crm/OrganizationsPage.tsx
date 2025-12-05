import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Building2 } from "lucide-react";
import { useCRMOrganizations } from "@/hooks/crm";
import { OrganizationDialog } from "@/components/crm/organizations/OrganizationDialog";
import { OrganizationsTable } from "@/components/crm/organizations/OrganizationsTable";
import { CRMOrganizationType } from "@/types/crm";
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
  { value: 'other', label: 'Other' },
];

export default function OrganizationsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [type, setType] = useState<CRMOrganizationType | "all">("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: organizations, isLoading } = useCRMOrganizations({
    searchTerm,
    type,
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Organizations</h1>
          <p className="text-muted-foreground text-sm">
            {organizations?.length || 0} organizations
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Organization
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search organizations..."
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
      />

      {/* Dialog */}
      <OrganizationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}
