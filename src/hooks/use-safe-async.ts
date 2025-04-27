
import { useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { PerformanceMonitor } from "@/utils/performance";

export function useSafeAsync<T>() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(true);
  
  // Set up cleanup when component unmounts
  useState(() => {
    return () => {
      setIsMounted(false);
    };
  });

  // Main execution function with safety features and performance monitoring
  const execute = useCallback(async <R>(
    asyncFn: () => Promise<R>,
    options?: {
      onSuccess?: (result: R) => void;
      onError?: (error: Error) => void;
      successMessage?: string;
      errorMessage?: string;
      finallyFn?: () => void;
    }
  ): Promise<R | undefined> => {
    if (isLoading) return;
    
    setIsLoading(true);
    let result: R | undefined;
    
    try {
      // Use performance monitoring for async operations
      result = await PerformanceMonitor.measureAsync('async-operation', async () => {
        // Use requestAnimationFrame to give UI time to update
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        
        // Execute the async function
        return await asyncFn();
      });
      
      // Only continue if component is still mounted
      if (!isMounted) return result;
      
      // Handle success
      if (options?.successMessage) {
        toast({
          title: "Success",
          description: options.successMessage,
        });
      }
      
      if (options?.onSuccess && isMounted) {
        // Use setTimeout to prevent UI thread blocking
        setTimeout(() => {
          if (isMounted) options.onSuccess!(result!);
        }, 10);
      }
      
      return result;
    } catch (error) {
      // Handle error with performance logging
      console.error("Operation failed:", error);
      
      if (!isMounted) return;
      
      const errorMsg = error instanceof Error 
        ? error.message 
        : "An unexpected error occurred";
      
      if (options?.errorMessage) {
        toast({
          title: "Error",
          description: options.errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
        });
      }
      
      if (options?.onError && isMounted) {
        options.onError(error instanceof Error ? error : new Error(errorMsg));
      }
    } finally {
      // Use requestAnimationFrame to ensure UI updates before state changes
      if (isMounted) {
        requestAnimationFrame(() => {
          if (isMounted) {
            setIsLoading(false);
            if (options?.finallyFn) {
              setTimeout(options.finallyFn, 10);
            }
          }
        });
      }
    }
  }, [isLoading, toast, isMounted]);

  return {
    isLoading,
    execute
  };
}
