
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

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

export function useUsersList() {
  const [isResendingEmail, setIsResendingEmail] = useState<string | null>(null);
  
  const { data: profiles, isLoading, refetch } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      // Get the latest data from profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('*');
      
      if (error) throw error;
      
      // For each profile, check the actual auth status to ensure we have the latest info
      if (data && data.length > 0) {
        const updatedProfiles = await Promise.all(
          data.map(async (profile) => {
            // Try to get the auth user info to check confirmed status
            const { data: authData } = await supabase.auth.admin.getUserById(profile.id);
            
            // If we got auth data and email confirmation status differs, update our local record
            if (authData && authData.user && 
                (profile.email_confirmed !== !!authData.user.email_confirmed_at)) {
              
              // Update the profile in the database
              await supabase.from('profiles')
                .update({ 
                  email_confirmed: !!authData.user.email_confirmed_at,
                  updated_at: new Date().toISOString()
                })
                .eq('id', profile.id);
                
              // Return updated profile
              return {
                ...profile,
                email_confirmed: !!authData.user.email_confirmed_at
              };
            }
            
            // Return original profile if no update needed
            return profile;
          })
        );
        
        return updatedProfiles as ProfileData[];
      }
      
      return data as ProfileData[];
    },
    refetchInterval: 30000, // Refresh data every 30 seconds
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

  const handleDeleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
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
    }
  };

  const handleResendConfirmation = async (email: string, userId: string) => {
    setIsResendingEmail(userId);
    try {
      // First attempt to resend the confirmation email
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;
      
      // Update the user profile to reflect that a new email has been sent
      // This doesn't change the confirmation status, just acknowledges the resend
      await supabase.from('profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', userId);

      toast({
        title: "Confirmation email sent",
        description: `A new confirmation email has been sent to ${email}.`,
      });
      
      // Refresh the profiles list to get latest data
      refetch();
    } catch (error: any) {
      console.error('Error resending confirmation email:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to resend confirmation email",
        variant: "destructive",
      });
    } finally {
      setIsResendingEmail(null);
    }
  };

  const getUserRoles = (userId: string) => {
    return userRoles?.filter(role => role.user_id === userId).map(ur => ur.role) || [];
  };

  return {
    profiles,
    isLoading,
    getUserRoles,
    handleDeleteUser,
    handleResendConfirmation,
    isResendingEmail,
    refetch,
  };
}
