
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { PasswordResetForm } from "@/components/auth/PasswordResetForm";
import { PasswordResetSuccess } from "@/components/auth/PasswordResetSuccess";
import { usePasswordReset } from "@/hooks/auth/usePasswordReset";

export default function RequestPasswordResetPage() {
  const {
    isLoading,
    formError,
    isSuccess,
    submittedEmail,
    submitPasswordReset,
    handleBackToLogin,
  } = usePasswordReset();

  if (isSuccess) {
    return (
      <PasswordResetSuccess 
        email={submittedEmail} 
        onBackToLogin={handleBackToLogin} 
      />
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md p-6 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Enter your email address below. If an account exists, we'll send you a link to reset your password.
          </p>
        </div>

        <PasswordResetForm
          onSubmit={submitPasswordReset}
          isLoading={isLoading}
          formError={formError}
        />

        <div className="mt-6 text-center text-sm">
          <Link to="/auth" className="text-primary hover:underline">
            Back to Login
          </Link>
        </div>
      </Card>
    </div>
  );
}
