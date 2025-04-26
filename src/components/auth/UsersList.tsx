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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProfileData {
  id: string;
  display_name: string;
  created_at: string;
  email_confirmed: boolean;
}

interface UserRoleData {
  user_id: string;
  role: string;
}

interface DeletionRequest {
  id: string;
  user_id: string;
  item_id: string;
  item_type: string;
  item_details: any;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export function UsersList() {
  const { toast } = useToast();
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const { data: deletionRequests, refetch: refetchDeletionRequests } = useQuery({
    queryKey: ['deletion-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deletion_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DeletionRequest[];
    },
  });

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId: userToDelete }
      });

      if (error) throw error;

      toast({
        title: "User deleted",
        description: "The user has been successfully deleted.",
      });

      refetch();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setUserToDelete(null);
      setIsDeleting(false);
    }
  };

  const handleApproveDeletion = async (requestId: string, itemId: string, itemType: string) => {
    try {
      const { error: updateError } = await supabase
        .from('deletion_requests')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      const { error: deleteError } = await supabase
        .from(itemType)
        .delete()
        .eq('id', itemId);

      if (deleteError) throw deleteError;

      toast({
        title: "Deletion approved",
        description: "The item has been successfully deleted.",
      });

      refetchDeletionRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve deletion",
        variant: "destructive",
      });
    }
  };

  const handleRejectDeletion = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('deletion_requests')
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Deletion rejected",
        description: "The deletion request has been rejected.",
      });

      refetchDeletionRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject deletion",
        variant: "destructive",
      });
    }
  };

  if (isLoading) return <div>Loading users...</div>;

  const getUserRoles = (userId: string) => {
    return userRoles?.filter(role => role.user_id === userId).map(ur => ur.role) || [];
  };

  return (
    <Tabs defaultValue="users" className="w-full">
      <TabsList>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="deletion-requests">
          Deletion Requests
          {deletionRequests?.length ? (
            <Badge variant="destructive" className="ml-2">
              {deletionRequests.length}
            </Badge>
          ) : null}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="users" className="border rounded-md mt-4">
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
                          disabled={isDeleting}
                        >
                          {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>

      <TabsContent value="deletion-requests" className="border rounded-md mt-4">
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
      </TabsContent>
    </Tabs>
  );
}
