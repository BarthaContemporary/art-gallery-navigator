
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

interface RetryButtonProps {
  onRetry: () => void;
  disabled?: boolean;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost";
  children?: React.ReactNode;
}

export function RetryButton({ 
  onRetry, 
  disabled = false, 
  size = "default",
  variant = "outline",
  children = "Try Again"
}: RetryButtonProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      // Add a small delay to show the loading state
      setTimeout(() => setIsRetrying(false), 500);
    }
  };

  return (
    <Button
      onClick={handleRetry}
      disabled={disabled || isRetrying}
      variant={variant}
      size={size}
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
      {isRetrying ? 'Retrying...' : children}
    </Button>
  );
}
