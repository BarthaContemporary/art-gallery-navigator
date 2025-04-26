
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useDeletionRequests } from "@/hooks/use-deletion-requests";
import { useUsersList } from "@/hooks/use-users-list";

export function DeletionRequestsTable() {
  const { deletionRequests, handleApproveDeletion, handleRejectDeletion } = useDeletionRequests();
  const { profiles } = useUsersList();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Requested By</TableHead>
          <TableHead>Item Type</TableHead>
          <TableHead>Details</TableHead>
          <TableHead>Requested At</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deletionRequests?.map((request) => (
          <TableRow key={request.id}>
            <TableCell>
              {profiles?.find(p => p.id === request.user_id)?.display_name || 'Unknown User'}
            </TableCell>
            <TableCell className="capitalize">{request.item_type}</TableCell>
            <TableCell>
              <pre className="text-sm whitespace-pre-wrap">
                {JSON.stringify(request.item_details, null, 2)}
              </pre>
            </TableCell>
            <TableCell>
              {new Date(request.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApproveDeletion(request.id, request.item_id, request.item_type)}
                  className="bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700"
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRejectDeletion(request.id)}
                  className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
                >
                  Reject
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {deletionRequests?.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
              No pending deletion requests
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
