import { CRMOrganization } from "@/types/crm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

interface OrganizationsTableProps {
  organizations: CRMOrganization[];
  isLoading: boolean;
}

export function OrganizationsTable({ organizations, isLoading }: OrganizationsTableProps) {
  const navigate = useNavigate();

  if (isLoading) return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (organizations.length === 0) return <div className="text-center py-12 text-muted-foreground">No organizations found</div>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Website</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {organizations.map((org) => (
          <TableRow
            key={org.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => navigate(`/crm/organizations/${org.id}`)}
          >
            <TableCell className="font-medium">{org.name}</TableCell>
            <TableCell><Badge variant="outline">{org.type}</Badge></TableCell>
            <TableCell>{[org.city, org.country].filter(Boolean).join(", ") || "-"}</TableCell>
            <TableCell>
              {org.website ? (
                <a
                  href={org.website}
                  target="_blank"
                  className="text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {org.website}
                </a>
              ) : "-"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
