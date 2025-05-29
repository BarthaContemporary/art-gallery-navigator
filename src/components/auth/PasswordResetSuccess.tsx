
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

interface PasswordResetSuccessProps {
  email: string;
  onBackToLogin: () => void;
}

export function PasswordResetSuccess({ email, onBackToLogin }: PasswordResetSuccessProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md p-6 shadow-lg text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Password Reset Email Sent</h1>
        <p className="text-muted-foreground mb-6">
          If an account exists for <strong>{email}</strong>, a password reset link has been sent. 
          Please check your inbox (and spam folder). It might take a few minutes to arrive.
        </p>
        <Button onClick={onBackToLogin} className="w-full">
          Back to Login
        </Button>
      </Card>
    </div>
  );
}
