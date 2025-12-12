import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EmailEnrichmentResult {
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  bio?: string;
  location?: string;
  profileUrl?: string;
  instagram_handle?: string;
  linkedin_handle?: string;
  source: 'gravatar' | 'none';
  message?: string;
}

export function useEmailEnrichment() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<EmailEnrichmentResult | null>(null);

  const enrichEmail = async (email: string): Promise<EmailEnrichmentResult | null> => {
    if (!email || !email.includes('@')) {
      return null;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('enrich-email', {
        body: { email },
      });

      if (error) {
        console.error('Email enrichment error:', error);
        toast.error('Failed to look up email');
        return null;
      }

      const enrichmentResult = data as EmailEnrichmentResult;
      setResult(enrichmentResult);

      if (enrichmentResult.source !== 'none' && enrichmentResult.fullName) {
        toast.success(`Found profile for ${enrichmentResult.fullName}`);
      }

      return enrichmentResult;
    } catch (error) {
      console.error('Email enrichment error:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    enrichEmail,
    isLoading,
    result,
  };
}
