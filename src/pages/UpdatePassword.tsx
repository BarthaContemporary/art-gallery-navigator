
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { AlertCircle, Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const updatePasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters long"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>;

export default function UpdatePasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authEventTriggered, setAuthEventTriggered] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase handles the token from the URL hash automatically on page load.
    // We listen for the PASSWORD_RECOVERY event to confirm the session is ready for password update.
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      logger.log("UpdatePasswordPage: Auth state changed", event, session ? "Session present" : "No session");
      if (event === "PASSWORD_RECOVERY") {
        setAuthEventTriggered(true);
        // The session is now active with the recovery token.
        // The user can now update their password.
      } else if (event === "SIGNED_IN" && authEventTriggered) {
        // This can happen after a successful password update if Supabase signs the user in.
        // Or if the user was already signed in and navigated here.
        // If it's right after PASSWORD_RECOVERY, we can consider the update process part of it.
      } else if (!session && !authEventTriggered) {
        // If there's no session and no PASSWORD_RECOVERY event, the link might be invalid or expired.
        // Delay this check slightly to allow Supabase to process the URL hash.
        setTimeout(() => {
            if(!authEventTriggered && !supabase.auth.getSession()){ // re-check after timeout
                 logger.warn("UpdatePasswordPage: No active session for password recovery. Redirecting to login.");
                 toast({
                    title: "Invalid or Expired Link",
                    description: "The password reset link may be invalid or expired. Please try again.",
                    variant: "destructive",
                  });
                 navigate("/auth");
            }
        }, 1500);
      }
    });
  
    // Initial check in case the event fired before listener was attached
    // or if Supabase sets up the session immediately from URL hash.
    // This part is a bit tricky as onAuthStateChange should catch it.
    // However, a direct getSession might be useful if the user refreshes the page.
    async function checkInitialSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        // If there's a session, we assume it's from the recovery link.
        // The onAuthStateChange listener would fire with PASSWORD_RECOVERY.
        // If it doesn't, it means the user is just regularly signed in.
        // The `authEventTriggered` flag handles this.
      }
    }
    checkInitialSession();

    return () => {
      authListener.subscription?.unsubscribe();
    };
  }, [navigate, authEventTriggered]);


  const form = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: UpdatePasswordFormValues) => {
    if (!authEventTriggered && !supabase.auth.getSession()) {
        setFormError("Password reset session is not active. The link might be invalid or expired.");
        logger.error("UpdatePasswordPage: Attempted password update without active recovery session.");
        return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (error) {
        logger.error("Update password error:", error.message, { errorDetails: error });
        setFormError(error.message || "Failed to update password. Please try again.");
      } else {
        logger.log("Password updated successfully.");
        setIsSuccess(true);
        toast({
          title: "Password Updated",
          description: "Your password has been successfully updated. Please log in.",
        });
        // Optionally sign the user out to force login with new password
        await supabase.auth.signOut(); 
        navigate("/auth");
      }
    } catch (error: any) {
      logger.error("Unexpected update password error:", error.message);
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background dark:bg-gray-900 p-4">
        <Card className="w-full max-w-md p-6 shadow-lg text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Password Successfully Reset!</h1>
          <p className="text-muted-foreground mb-6">
            You can now log in with your new password.
          </p>
          <Button onClick={() => navigate("/auth")} className="w-full">
            Go to Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md p-6 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Set New Password</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Please enter your new password below.
          </p>
        </div>

        {formError && (
          <div className="mb-4 flex items-center text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/30 rounded-md">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        placeholder="New Password"
                        className="text-base sm:text-sm py-3 pr-10"
                        disabled={isLoading}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                     <div className="relative">
                      <Input
                        {...field}
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm New Password"
                        className="text-base sm:text-sm py-3 pr-10"
                        disabled={isLoading}
                      />
                       <button 
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full h-12 sm:h-10 text-lg sm:text-base" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : "Update Password"}
            </Button>
          </form>
        </Form>
      </Card>
    </div>
  );
}
