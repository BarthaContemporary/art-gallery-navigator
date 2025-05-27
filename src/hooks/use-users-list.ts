import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast"; // Ensure this is the shadcn useToast
import { useState } from "react";
import { logger } from "@/lib/logger"; // Added logger

interface ProfileData {
  id: string;
  display_name: string; // This is typically the email
  created_at: string;
  email_confirmed: boolean;
}

interface UserRoleData {
  user_id: string;
  role: string;
}

export function useUsersList() {
  const [isResendingEmail, setIsResendingEmail] = useState<string | null>(null);
  const [isSendingResetForUserId, setIsSendingResetForUserId] = useState<string | null>(null); // New state
  
  const { data: profiles, isLoading, refetch } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      // Get profiles data with email confirmation status
      const { data, error } = await supabase
        .from('profiles')
        .select('*');
      
      if (error) throw error;
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

  const handleAdminSendPasswordReset = async (email: string, userId: string) => {
    setIsSendingResetForUserId(userId);
    try {
      const appBaseUrl = window.location.origin;
      const { error } = await supabase.functions.invoke('admin-send-password-reset', {
        body: { targetUserEmail: email, appBaseUrl: appBaseUrl }
      });

      if (error) {
        logger.error('Error invoking admin-send-password-reset function:', error);
        throw new Error(error.message || 'Function invocation failed');
      }
      
      toast({
        title: "Password Reset Sent",
        description: `A password reset link has been sent to ${email}.`,
      });
      
    } catch (error: any) {
      logger.error('Error sending admin password reset:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send password reset link",
        variant: "destructive",
      });
    } finally {
      setIsSendingResetForUserId(null);
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
    handleAdminSendPasswordReset, // Expose new function
    isSendingResetForUserId, // Expose new state
    refetch,
  };
}
