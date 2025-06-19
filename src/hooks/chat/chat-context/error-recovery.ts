
import { useCallback, useRef } from 'react';
import { ChatAction } from './types';
import { toast } from 'sonner';

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

export function useChatErrorRecovery(dispatch?: React.Dispatch<ChatAction>) {
  const retryAttempts = useRef<Map<string, number>>(new Map());
  const retryTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const defaultConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
  };

  const calculateDelay = useCallback((attempt: number, config: RetryConfig): number => {
    const delay = config.baseDelay * Math.pow(2, attempt);
    return Math.min(delay, config.maxDelay);
  }, []);

  const handleError = useCallback(async (
    operationKey: string,
    error: unknown,
    retryFunction: () => Promise<void> | void,
    config: Partial<RetryConfig> = {}
  ) => {
    const finalConfig = { ...defaultConfig, ...config };
    const currentAttempts = retryAttempts.current.get(operationKey) || 0;

    console.error(`Error in ${operationKey} (attempt ${currentAttempts + 1}):`, error);

    if (dispatch) {
      dispatch({
        type: 'SET_CONNECTION_STATE',
        payload: {
          retryCount: currentAttempts + 1,
        },
      });
    }

    if (currentAttempts < finalConfig.maxRetries) {
      const nextAttempt = currentAttempts + 1;
      retryAttempts.current.set(operationKey, nextAttempt);

      const delay = calculateDelay(currentAttempts, finalConfig);
      
      // Clear any existing timer for this operation
      const existingTimer = retryTimers.current.get(operationKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Show retry notification
      toast.error(`${operationKey} failed. Retrying in ${Math.round(delay / 1000)}s... (${nextAttempt}/${finalConfig.maxRetries})`);

      const timer = setTimeout(async () => {
        try {
          await retryFunction();
          // Reset retry count on success
          retryAttempts.current.delete(operationKey);
          retryTimers.current.delete(operationKey);
          
          if (dispatch) {
            dispatch({
              type: 'SET_CONNECTION_STATE',
              payload: {
                status: 'connected',
                retryCount: 0,
              },
            });
          }
          
          toast.success(`${operationKey} recovered successfully`);
        } catch (retryError) {
          // Recursive call for next retry
          handleError(operationKey, retryError, retryFunction, config);
        }
      }, delay);

      retryTimers.current.set(operationKey, timer);
    } else {
      // Max retries reached
      retryAttempts.current.delete(operationKey);
      retryTimers.current.delete(operationKey);
      
      if (dispatch) {
        dispatch({
          type: 'SET_ERROR',
          payload: {
            key: operationKey,
            error: `Failed after ${finalConfig.maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        });
        
        dispatch({
          type: 'SET_CONNECTION_STATE',
          payload: {
            status: 'error',
            error: `Max retries reached for ${operationKey}`,
          },
        });
      }
      
      toast.error(`${operationKey} failed permanently after ${finalConfig.maxRetries} attempts`);
    }
  }, [dispatch, calculateDelay]);

  const clearRetries = useCallback((operationKey?: string) => {
    if (operationKey) {
      retryAttempts.current.delete(operationKey);
      const timer = retryTimers.current.get(operationKey);
      if (timer) {
        clearTimeout(timer);
        retryTimers.current.delete(operationKey);
      }
    } else {
      // Clear all
      retryAttempts.current.clear();
      retryTimers.current.forEach(timer => clearTimeout(timer));
      retryTimers.current.clear();
    }
  }, []);

  const getRetryCount = useCallback((operationKey: string): number => {
    return retryAttempts.current.get(operationKey) || 0;
  }, []);

  return {
    handleError,
    clearRetries,
    getRetryCount,
  };
}
