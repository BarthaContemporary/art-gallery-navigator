import { useCallback, useEffect, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useDebouncedCallback } from './use-debounced-callback';

interface UseAutosaveOptions<T> {
  form: UseFormReturn<T>;
  onSave: (data: T) => Promise<void> | void;
  delay?: number;
  enabled?: boolean;
}

export function useAutosave<T>({ 
  form, 
  onSave, 
  delay = 2000, 
  enabled = true 
}: UseAutosaveOptions<T>) {
  const previousValuesRef = useRef<string>('');
  const isInitializedRef = useRef(false);
  
  const debouncedSave = useDebouncedCallback(
    useCallback(async (data: T) => {
      if (!enabled) {
        console.log('Autosave: Disabled, skipping save');
        return;
      }
      
      console.log('Autosave: Attempting to save data:', data);
      
      try {
        // For autosave, we'll do minimal validation - just check required fields
        const hasRequiredFields = (data as any).title && (data as any).artist_id;
        
        if (hasRequiredFields) {
          console.log('Autosave: Required fields present, proceeding with save');
          await onSave(data);
          console.log('Autosave: Successfully saved');
        } else {
          console.log('Autosave: Skipping save - missing required fields (title or artist_id)');
        }
      } catch (error) {
        console.error('Autosave: Failed to save:', error);
        throw error; // Let the calling component handle the error
      }
    }, [form, onSave, enabled]),
    delay
  );

  useEffect(() => {
    console.log('Autosave: Setting up watch with enabled =', enabled);
    if (!enabled) return;

    const subscription = form.watch((data) => {
      // Skip the first call which happens on initialization
      if (!isInitializedRef.current) {
        console.log('Autosave: Initializing, skipping first call');
        isInitializedRef.current = true;
        previousValuesRef.current = JSON.stringify(data);
        return;
      }

      const currentValues = JSON.stringify(data);
      
      // Only trigger save if values have actually changed
      if (currentValues !== previousValuesRef.current) {
        console.log('Autosave: Form data changed, scheduling save');
        previousValuesRef.current = currentValues;
        debouncedSave(data as T);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, debouncedSave, enabled]);

  return {
    triggerSave: () => {
      const data = form.getValues();
      debouncedSave(data);
    }
  };
}