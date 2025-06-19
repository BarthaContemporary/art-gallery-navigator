
import { useRef, useCallback } from 'react';
import { RetryConfig } from './types';

export function useRetryManager() {
  const retryTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const retryConfig: RetryConfig = {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000,
  };

  const getRetryDelay = useCallback((retryCount: number): number => {
    const delay = retryConfig.baseDelay * Math.pow(2, retryCount);
    return Math.min(delay, retryConfig.maxDelay);
  }, []);

  const scheduleRetry = useCallback((callback: () => void, retryCount: number) => {
    if (retryTimeout.current) {
      clearTimeout(retryTimeout.current);
    }
    
    const delay = getRetryDelay(retryCount);
    console.log(`Scheduling retry in ${delay}ms... (${retryCount + 1}/${retryConfig.maxRetries})`);
    
    retryTimeout.current = setTimeout(callback, delay);
  }, [getRetryDelay]);

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeout.current) {
      clearTimeout(retryTimeout.current);
      retryTimeout.current = null;
    }
  }, []);

  return {
    retryConfig,
    scheduleRetry,
    clearRetryTimeout,
    getRetryDelay
  };
}
