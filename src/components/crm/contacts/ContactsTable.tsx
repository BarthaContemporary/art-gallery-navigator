import { CRMContact } from "@/types/crm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

interface ContactsTableProps {
  contacts: CRMContact[];
  isLoading: boolean;
  selectedContacts: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function ContactsTable({ contacts, isLoading, selectedContacts, onSelectionChange }: ContactsTableProps) {
  const navigate = useNavigate();

  const toggleAll = () => {
    if (selectedContacts.length === contacts.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(contacts.map(c => c.id));
    }
  };

  const toggleOne = (id: string) => {
    if (selectedContacts.includes(id)) {
      onSelectionChange(selectedContacts.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedContacts, id]);
    }
  };

  if (isLoading) {
    return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  if (contacts.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No contacts found</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox checked={selectedContacts.length === contacts.length && contacts.length > 0} onCheckedChange={toggleAll} />
          </TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Tags</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contacts.map((contact) => (
          <TableRow key={contact.id} className="cursor-pointer" onClick={() => navigate(`/crm/contacts/${contact.id}`)}>
            <TableCell onClick={(e) => e.stopPropagation()}>
              <Checkbox checked={selectedContacts.includes(contact.id)} onCheckedChange={() => toggleOne(contact.id)} />
            </TableCell>
            <TableCell className="font-medium">{contact.full_name}</TableCell>
            <TableCell>{contact.email || "-"}</TableCell>
            <TableCell>{contact.phone || "-"}</TableCell>
            <TableCell><Badge variant="outline">{contact.contact_type}</Badge></TableCell>
            <TableCell>
              <div className="flex gap-1">{contact.tags?.slice(0, 2).map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}</div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
