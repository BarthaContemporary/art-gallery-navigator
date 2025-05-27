
import { Form } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

import { usePasswordRecoverySession } from "@/hooks/auth/usePasswordRecoverySession";
import { useUpdatePasswordForm } from "@/hooks/auth/useUpdatePasswordForm";
import { UpdatePasswordHeader } from "@/components/auth/UpdatePasswordHeader";
import { UpdatePasswordFormFields } from "@/components/auth/UpdatePasswordFormFields";
import { UpdatePasswordSuccessView } from "@/components/auth/UpdatePasswordSuccessView";
import { logger } from "@/lib/logger"; // Keep logger for any page-specific logs if needed

export default function UpdatePasswordPage() {
  const { authEventTriggered, isSessionReady } = usePasswordRecoverySession();
  
  // Defer form initialization until session is confirmed ready, or authEventTriggered is true
  // This prevents form submission attempts before recovery session is active.
  const { 
    form, 
    isLoading, 
    formError, 
    isSuccess, 
    currentPassword, 
    onSubmit,
    setFormError // If needed for session readiness issues
  } = useUpdatePasswordForm(authEventTriggered || isSessionReady);


  // Effect to handle cases where session is not ready after hook initialization.
  // This is a fallback, primary logic is in usePasswordRecoverySession.
  // useEffect(() => {
  //   if (!isSessionReady && !authEventTriggered) {
  //     // The hook usePasswordRecoverySession should handle redirection.
  //     // This is an additional safety net or for specific error messages.
  //     // For example, if the page loads but the session check fails later.
  //     logger.warn("UpdatePasswordPage: Session not ready, form interactions might be blocked or lead to errors.");
  //     // Potentially set a formError here if not handled by the hook already via toast/navigation
  //     // setFormError("Password recovery session is not ready. Please try refreshing or request a new link.");
  //   }
  // }, [isSessionReady, authEventTriggered, setFormError]);


  if (isSuccess) {
    return <UpdatePasswordSuccessView />;
  }

  // Optional: Show a loading state or placeholder while session is being verified
  // if (!isSessionReady && !authEventTriggered) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen bg-background dark:bg-gray-900 p-4">
  //       <Card className="w-full max-w-md p-6 shadow-lg text-center">
  //         <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
  //         <p className="text-muted-foreground">Verifying password reset link...</p>
  //       </Card>
  //     </div>
  //   );
  // }


  return (
    <div className="flex items-center justify-center min-h-screen bg-background dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md p-6 shadow-lg">
        <UpdatePasswordHeader />

        {formError && (
          <div className="mb-4 flex items-center text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/30 rounded-md">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}
        
        {/* Render form only if session is considered ready or authEvent was triggered */}
        {(isSessionReady || authEventTriggered) ? (
          <Form {...form}>
            <UpdatePasswordFormFields
              form={form}
              isLoading={isLoading}
              currentPasswordForStrengthMeter={currentPassword}
              onSubmit={onSubmit}
            />
          </Form>
        ) : (
          <div className="text-center py-4">
            <p className="text-muted-foreground">Verifying session...</p>
            {/* Optionally, add a spinner here if desired for this state */}
          </div>
        )}
      </Card>
    </div>
  );
}
