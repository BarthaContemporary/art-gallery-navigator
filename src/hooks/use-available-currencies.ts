import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useAvailableCurrencies() {
  return useQuery({
    queryKey: ['available-currencies'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc('get_available_currencies');
      
      if (error) {
        console.error('Error fetching available currencies:', error);
        throw error;
      }

      // Return the array, or default currencies if empty
      return data && data.length > 0 ? data : ['USD', 'EUR', 'GBP', 'CHF'];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}