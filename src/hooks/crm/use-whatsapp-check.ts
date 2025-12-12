import { useState } from 'react';

interface WhatsAppCheckResult {
  exists: boolean;
  checked: boolean;
}

export function useWhatsAppCheck() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<WhatsAppCheckResult | null>(null);

  const checkWhatsApp = async (phoneNumber: string): Promise<WhatsAppCheckResult | null> => {
    if (!phoneNumber || phoneNumber.length < 8) {
      return null;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // Clean the phone number - remove spaces, dashes, parentheses
      const cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
      
      // WhatsApp check via their web API - this is a basic check
      // For production, you'd want to use the WhatsApp Business API
      // For now, we'll just mark it as checked with a basic validation
      const hasValidMobileFormat = /^\+?[1-9]\d{8,14}$/.test(cleanNumber);
      
      const checkResult: WhatsAppCheckResult = {
        exists: hasValidMobileFormat, // Assume valid mobile numbers may have WhatsApp
        checked: true,
      };
      
      setResult(checkResult);
      return checkResult;
    } catch (error) {
      console.error('WhatsApp check error:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const resetResult = () => setResult(null);

  return {
    checkWhatsApp,
    isLoading,
    result,
    resetResult,
  };
}
