import React from 'react';
import { useCurrencyConversion } from '@/hooks/use-currency-conversion';
import { Loader2 } from 'lucide-react';

interface ConvertedPriceProps {
  price?: number;
  currency?: string;
  className?: string;
}

export function ConvertedPrice({ price, currency, className = "" }: ConvertedPriceProps) {
  const { convertedPrice, displayCurrency, isConverted, isLoading, error } = useCurrencyConversion(price, currency);

  if (!price || !currency) {
    return <span className={className}>&nbsp;</span>;
  }

  if (error) {
    // Fallback to original price if conversion fails
    return (
      <span className={className}>
        {currency} {Number(price).toLocaleString().replace(/,/g, "'")}
      </span>
    );
  }

  if (isLoading) {
    return (
      <span className={`${className} flex items-center gap-1`}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Converting...
      </span>
    );
  }

  const formattedPrice = Number(convertedPrice).toLocaleString().replace(/,/g, "'");

  return (
    <span className={className}>
      {isConverted && '~'}{displayCurrency} {formattedPrice}
      {isConverted && (
        <span className="text-xs text-muted-foreground ml-1">
          ({currency})
        </span>
      )}
    </span>
  );
}