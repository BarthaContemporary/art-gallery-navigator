
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "@/components/ui/use-toast";
import { updatePasswordSchema, UpdatePasswordFormValues } from "@/schemas/auth/updatePasswordSchema";
import { updateUserPassword } from "@/services/auth/passwordService";

export function useUpdatePasswordForm(authEventTriggered: boolean) {
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const navigate = useNavigate();

  const form = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });

  const watchedPassword = form.watch("password");
  useEffect(() => {
    setCurrentPassword(watchedPassword || "");
  }, [watchedPassword]);

  const onSubmit = async (values: UpdatePasswordFormValues) => {
    setIsLoading(true);
    setFormError(null);

    if (!authEventTriggered) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setFormError("Password reset session is not active or has expired. Please request a new reset link.");
        logger.error("useUpdatePasswordForm: Attempted password update without active recovery session.");
        setIsLoading(false);
        return;
      }
      logger.warn("useUpdatePasswordForm: authEventTriggered was false, but proceeding with update as a session exists.");
    }

    const result = await updateUserPassword(values.password);

    if (result.success) {
      logger.log("Password updated successfully (from hook).");
      setIsSuccess(true);
      toast({
        title: "Password Updated Successfully!",
        description: "Your password has been changed. You will be redirected to the login page.",
        className: "bg-green-500 text-white",
      });
      // It's good practice to sign out the user after a password change for security,
      // especially if the change was initiated via a recovery link.
      // Supabase's updateUser might invalidate other sessions, but an explicit signOut here is clearer.
      try {
        await supabase.auth.signOut();
        logger.log("User signed out after password update.");
      } catch (signOutError: any) {
        logger.error("Error signing out after password update:", signOutError.message);
        // Continue with navigation even if sign out fails, as password update was successful.
      }
      setTimeout(() => navigate("/auth"), 2000);
    } else {
      logger.error("Failed to update password (from hook):", result.error?.message, { errorDetails: result.error?.details });
      setFormError(result.error?.message || "Failed to update password. Please ensure your new password meets the requirements and try again. If the problem persists, you may need to request a new reset link.");
    }

    setIsLoading(false);
  };

  return {
    form,
    isLoading,
    formError,
    isSuccess,
    currentPassword,
    onSubmit,
    setFormError,
  };
}
