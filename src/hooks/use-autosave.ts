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
      
      // Validate form before saving
      const isValid = await form.trigger();
      console.log('Autosave: Form validation result:', isValid);
      
      if (isValid) {
        try {
          await onSave(data);
          console.log('Autosave: Successfully saved');
        } catch (error) {
          console.error('Autosave: Failed to save:', error);
        }
      } else {
        console.log('Autosave: Skipping save due to validation errors:', form.formState.errors);
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