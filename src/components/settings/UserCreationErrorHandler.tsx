
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Mail } from "lucide-react";

interface UserCreationError {
  type: 'email' | 'captcha' | 'network' | 'unknown';
  message: string;
  canRetry: boolean;
  suggestedAction?: string;
}

interface UserCreationErrorHandlerProps {
  error: UserCreationError | null;
  onRetry: () => void;
  onManualActivation?: (email: string) => void;
  userEmail?: string;
  isRetrying: boolean;
}

export function UserCreationErrorHandler({ 
  error, 
  onRetry, 
  onManualActivation, 
  userEmail,
  isRetrying 
}: UserCreationErrorHandlerProps) {
  if (!error) return null;

  const getErrorIcon = () => {
    switch (error.type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getErrorVariant = () => {
    switch (error.type) {
      case 'email':
        return 'default' as const;
      default:
        return 'destructive' as const;
    }
  };

  return (
    <Alert variant={getErrorVariant()} className="mt-4">
      {getErrorIcon()}
      <AlertDescription className="space-y-3">
        <div>
          <strong>Error:</strong> {error.message}
          {error.suggestedAction && (
            <div className="mt-1 text-sm">
              <strong>Suggestion:</strong> {error.suggestedAction}
            </div>
          )}
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {error.canRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              disabled={isRetrying}
              className="flex items-center gap-1"
            >
              {isRetrying ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {isRetrying ? "Retrying..." : "Retry"}
            </Button>
          )}
          
          {error.type === 'email' && onManualActivation && userEmail && (
            <Button
              size="sm"
              variant="default"
              onClick={() => onManualActivation(userEmail)}
              className="flex items-center gap-1"
            >
              <Mail className="h-3 w-3" />
              Send Manual Activation
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
