
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "@/components/ui/use-toast";

export const updatePasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters long. For better security, include uppercase, lowercase, numbers, and special characters."),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>;

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
    mode: "onChange", // Validate on change for better UX with strength meter and submit button
  });

  const watchedPassword = form.watch("password");
  useEffect(() => {
    setCurrentPassword(watchedPassword || "");
  }, [watchedPassword]);

  const onSubmit = async (values: UpdatePasswordFormValues) => {
    if (!authEventTriggered) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setFormError("Password reset session is not active or has expired. Please request a new reset link.");
        logger.error("useUpdatePasswordForm: Attempted password update without active recovery session.");
        return;
      }
      // If session exists but authEventTriggered was false, it might be a recovery session that was missed by the listener initially.
      // Trust Supabase.auth.updateUser will work if the token is valid.
      logger.warn("useUpdatePasswordForm: authEventTriggered was false, but proceeding with update as a session exists.");
    }


    setIsLoading(true);
    setFormError(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (error) {
        logger.error("Update password error:", error.message, { errorDetails: error });
        setFormError(error.message || "Failed to update password. Please ensure your new password meets the requirements and try again. If the problem persists, you may need to request a new reset link.");
      } else {
        logger.log("Password updated successfully.");
        setIsSuccess(true);
        toast({
          title: "Password Updated Successfully!",
          description: "Your password has been changed. You will be redirected to the login page.",
          className: "bg-green-500 text-white",
        });
        await supabase.auth.signOut(); 
        setTimeout(() => navigate("/auth"), 2000);
      }
    } catch (error: any) {
      logger.error("Unexpected update password error:", error.message);
      setFormError("An unexpected error occurred. Please try again or contact support if the issue continues.");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    form,
    isLoading,
    formError,
    isSuccess,
    currentPassword,
    onSubmit,
    setFormError, // Expose to allow clearing/setting error from parent if needed
  };
}
