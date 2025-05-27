import { useState, useEffect } from "react";
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
import { CheckCircle2, Mail, Trash2, XCircle, RefreshCw, Send, KeyRound } from "lucide-react";
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
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export function UsersTable() {
  const { 
    profiles, 
    isLoading, 
    getUserRoles, 
    handleDeleteUser, 
    handleResendConfirmation, 
    isResendingEmail, 
    refetch,
    handleAdminSendPasswordReset,
    isSendingResetForUserId,
  } = useUsersList();
  
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userForPasswordReset, setUserForPasswordReset] = useState<{ id: string; email: string } | null>(null);

  // Force refresh on initial load to ensure we have the latest data
  useEffect(() => {
    refetch();
  }, [refetch]);

  const onDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    await handleDeleteUser(userToDelete);
    setUserToDelete(null);
    setIsDeleting(false);
  };

  const handleRefreshList = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 1000); // Show refresh animation for at least 1 second
  };

  const onAdminSendPasswordReset = async () => {
    if (!userForPasswordReset) return;
    await handleAdminSendPasswordReset(userForPasswordReset.email, userForPasswordReset.id);
    setUserForPasswordReset(null);
  };

  if (isLoading) return <div className="p-8 text-center">Loading users...</div>;

  return (
    <div className="min-w-[600px]">
      <div className="flex justify-end p-4">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-1"
          onClick={handleRefreshList}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User (Email)</TableHead>
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
                <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
                  {!profile.email_confirmed && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Resend Confirmation Email"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => handleResendConfirmation(profile.display_name, profile.id)}
                      disabled={isResendingEmail === profile.id || isSendingResetForUserId === profile.id}
                    >
                      {isResendingEmail === profile.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    </Button>
                  )}
                  {isAdmin && (
                    <AlertDialog open={userForPasswordReset?.id === profile.id} onOpenChange={(isOpen) => !isOpen && setUserForPasswordReset(null)}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Send Password Reset Link"
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          onClick={() => setUserForPasswordReset({ id: profile.id, email: profile.display_name })}
                          disabled={isSendingResetForUserId === profile.id || isResendingEmail === profile.id}
                        >
                          {isSendingResetForUserId === profile.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Send Password Reset Link?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will send a password reset link to <strong>{profile.display_name}</strong>.
                            Are you sure you want to proceed?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setUserForPasswordReset(null)}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-orange-600 text-orange-foreground hover:bg-orange-600/90"
                            onClick={onAdminSendPasswordReset}
                            disabled={isSendingResetForUserId === profile.id}
                          >
                            {isSendingResetForUserId === profile.id ? "Sending..." : "Send Link"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
              </TableCell>
              <TableCell>
                <div className="flex space-x-1">
                  <AlertDialog open={userToDelete === profile.id} onOpenChange={(isOpen) => !isOpen && setUserToDelete(null)}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete User"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setUserToDelete(profile.id)}
                        disabled={isSendingResetForUserId === profile.id || isResendingEmail === profile.id || isDeleting}
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
