
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Trash2, XCircle } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Interface for profiles from our database
interface ProfileData {
  id: string;
  display_name: string;
  created_at: string;
  email_confirmed: boolean;
}

// Interface for user roles from our database
interface UserRoleData {
  user_id: string;
  role: string;
}

export function UsersList() {
  const { toast } = useToast();
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  const { data: profiles, isLoading, refetch } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*');
      if (error) throw error;
      return data as ProfileData[];
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (error) throw error;
      return data as UserRoleData[];
    },
  });

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      // Delete the user from auth
      const { error: deleteError } = await supabase.auth.admin.deleteUser(
        userToDelete
      );

      if (deleteError) throw deleteError;

      toast({
        title: "User deleted",
        description: "The user has been successfully deleted.",
      });

      // Refresh the users list
      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setUserToDelete(null);
    }
  };

  if (isLoading) return <div>Loading users...</div>;

  const getUserRoles = (userId: string) => {
    return userRoles?.filter(role => role.user_id === userId).map(ur => ur.role) || [];
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Email Status</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles?.map((profile) => (
            <TableRow key={profile.id}>
              <TableCell>{profile.display_name}</TableCell>
              <TableCell>
                {profile.email_confirmed ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Confirmed</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <XCircle className="h-4 w-4" />
                    <span>Pending</span>
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {getUserRoles(profile.id).map((role) => (
                    <Badge key={role} variant="secondary">
                      {role}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
              </TableCell>
              <TableCell>
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
                        onClick={handleDeleteUser}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
