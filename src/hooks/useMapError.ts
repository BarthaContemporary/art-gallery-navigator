
import { useState, useCallback } from 'react';

export function useMapError(maxRetries: number = 3) {
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleError = useCallback((err: Error) => {
    console.error("Map initialization error:", err);
    const errorMessage = err.message;
    
    if (errorMessage.includes("not found")) {
      setError("Address not found. Please check the address format.");
    } else if (errorMessage.includes("service")) {
      setError("Map service temporarily unavailable");
    } else {
      setError("Failed to load map");
    }
  }, []);

  const canRetry = retryCount < maxRetries;

  const retry = useCallback(() => {
    if (canRetry) {
      setRetryCount(prev => prev + 1);
      setError(null);
      return true;
    }
    return false;
  }, [canRetry]);

  const resetError = useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  return {
    error,
    retryCount,
    maxRetries,
    canRetry,
    handleError,
    retry,
    resetError
  };
}
