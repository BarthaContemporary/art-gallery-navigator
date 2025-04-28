
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Mail, Trash2, XCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useUsersList } from "@/hooks/use-users-list";

export function UsersTable() {
  const { profiles, isLoading, getUserRoles, handleDeleteUser, handleResendConfirmation, isResendingEmail } = useUsersList();
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (isLoading) return <div>Loading users...</div>;

  const onDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    await handleDeleteUser(userToDelete);
    setUserToDelete(null);
    setIsDeleting(false);
  };

  return (
    <div className="min-w-[600px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Email Status</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead className="hidden sm:table-cell">Created At</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles?.map((profile) => (
            <TableRow key={profile.id}>
              <TableCell className="font-medium">{profile.display_name}</TableCell>
              <TableCell>
                {profile.email_confirmed ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Confirmed</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-yellow-600">
                    <XCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Pending</span>
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {getUserRoles(profile.id).map((role) => (
                    <Badge key={role} variant="secondary" className="whitespace-nowrap">
                      {role}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
              </TableCell>
              <TableCell>
                <div className="flex space-x-1">
                  {!profile.email_confirmed && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => handleResendConfirmation(profile.display_name, profile.id)}
                      disabled={isResendingEmail === profile.id}
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                  )}
                  <AlertDialog open={userToDelete === profile.id} onOpenChange={(isOpen) => !isOpen && setUserToDelete(null)}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setUserToDelete(profile.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the user
                          account and remove all associated data.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={onDeleteUser}
                          disabled={isDeleting}
                        >
                          {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
