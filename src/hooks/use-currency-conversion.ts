import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/contexts/CurrencyContext';

interface ConvertedPrice {
  originalPrice: number;
  originalCurrency: string;
  convertedPrice: number;
  displayCurrency: string;
  isConverted: boolean;
  isLoading: boolean;
  error?: string;
}

const exchangeRateCache = new Map<string, { rate: number; expires: number }>();

export function useCurrencyConversion(originalPrice?: number, originalCurrency?: string): ConvertedPrice {
  const { selectedCurrency } = useCurrency();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [convertedPrice, setConvertedPrice] = useState<number>(originalPrice || 0);

  const convertPrice = useCallback(async () => {
    if (!originalPrice || !originalCurrency || !selectedCurrency) {
      setConvertedPrice(originalPrice || 0);
      return;
    }

    // If same currency, no conversion needed
    if (originalCurrency === selectedCurrency) {
      setConvertedPrice(originalPrice);
      return;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      const cacheKey = `${originalCurrency}-${selectedCurrency}`;
      const cached = exchangeRateCache.get(cacheKey);
      
      let rate: number;

      // Use cached rate if available and not expired
      if (cached && cached.expires > Date.now()) {
        rate = cached.rate;
      } else {
        // Fetch fresh rate
        const { data, error: functionError } = await supabase.functions.invoke('exchange-rates', {
          body: { from: originalCurrency, to: selectedCurrency }
        });

        if (functionError) {
          throw new Error(functionError.message);
        }

        if (!data?.rate) {
          throw new Error('Invalid response from exchange rate service');
        }

        rate = data.rate;

        // Cache for 15 minutes
        exchangeRateCache.set(cacheKey, {
          rate,
          expires: Date.now() + 15 * 60 * 1000
        });
      }

      // Apply conversion formula: rate * 1.015 (add 1.5%) then round up to next 200
      const convertedAmount = originalPrice * rate * 1.015;
      const roundedAmount = Math.ceil(convertedAmount / 200) * 200;

      setConvertedPrice(roundedAmount);
    } catch (err) {
      console.error('Currency conversion error:', err);
      setError(err instanceof Error ? err.message : 'Conversion failed');
      setConvertedPrice(originalPrice); // Fallback to original price
    } finally {
      setIsLoading(false);
    }
  }, [originalPrice, originalCurrency, selectedCurrency]);

  useEffect(() => {
    convertPrice();
  }, [convertPrice]);

  return {
    originalPrice: originalPrice || 0,
    originalCurrency: originalCurrency || '',
    convertedPrice,
    displayCurrency: selectedCurrency,
    isConverted: originalCurrency !== selectedCurrency && !!originalCurrency,
    isLoading,
    error
  };
}