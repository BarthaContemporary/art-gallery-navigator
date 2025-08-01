import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAvailableCurrencies } from '@/hooks/use-available-currencies';
import { DollarSign } from 'lucide-react';
export function CurrencySelector() {
  const {
    selectedCurrency,
    setSelectedCurrency
  } = useCurrency();
  const {
    data: currencies = [],
    isLoading
  } = useAvailableCurrencies();
  if (isLoading || currencies.length <= 1) {
    return null;
  }
  return <div className="flex items-center gap-2">
      
      <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
        <SelectTrigger className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {currencies.map(currency => <SelectItem key={currency} value={currency}>
              {currency}
            </SelectItem>)}
        </SelectContent>
      </Select>
    </div>;
}