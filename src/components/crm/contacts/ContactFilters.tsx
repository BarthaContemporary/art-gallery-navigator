import { CRMContactType } from "@/types/crm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";

interface ContactFiltersProps {
  contactType: CRMContactType | "all";
  onContactTypeChange: (type: CRMContactType | "all") => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

const contactTypes: { value: CRMContactType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'collector', label: 'Collector' },
  { value: 'curator', label: 'Curator' },
  { value: 'gallerist', label: 'Gallerist' },
  { value: 'press', label: 'Press' },
  { value: 'institution', label: 'Institution' },
  { value: 'vip', label: 'VIP' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'other', label: 'Other' },
];

export function ContactFilters({ contactType, onContactTypeChange }: ContactFiltersProps) {
  return (
    <div className="flex gap-2">
      <Select value={contactType} onValueChange={(v) => onContactTypeChange(v as CRMContactType | "all")}>
        <SelectTrigger className="w-40">
          <Users className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          {contactTypes.map((t) => (
            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
