
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ComposeEmailOptions {
  to: string;
  subject?: string;
  body?: string;
}

interface UseGmailComposeReturn {
  composeEmail: (options: ComposeEmailOptions) => Promise<void>;
  isLoading: boolean;
}

export function useGmailCompose(): UseGmailComposeReturn {
  const [isLoading, setIsLoading] = useState(false);

  const composeEmail = async ({ to, subject = '', body = '' }: ComposeEmailOptions) => {
    if (!to) {
      toast.error('Email address is required');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('compose-gmail-email', {
        body: { to, subject, body }
      });

      if (error) {
        console.error('Error calling Gmail compose function:', error);
        // Fallback to mailto
        const fallbackUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(fallbackUrl, '_blank');
        toast.info('Using default email client');
        return;
      }

      if (data?.success && data?.composeUrl) {
        // Open Gmail compose in new tab
        window.open(data.composeUrl, '_blank');
        toast.success('Opening Gmail composer');
      } else {
        // Use fallback mailto URL
        const fallbackUrl = data?.fallbackMailto || `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(fallbackUrl, '_blank');
        toast.info('Using default email client');
      }
    } catch (error) {
      console.error('Error composing email:', error);
      // Final fallback to mailto
      const fallbackUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(fallbackUrl, '_blank');
      toast.error('Error opening Gmail, using default email client');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    composeEmail,
    isLoading
  };
}
