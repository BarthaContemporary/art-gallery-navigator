import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';

interface CurrencyContextType {
  selectedCurrency: string;
  setSelectedCurrency: (currency: string) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

interface CurrencyProviderProps {
  children: ReactNode;
}

export function CurrencyProvider({ children }: CurrencyProviderProps) {
  const [selectedCurrency, setSelectedCurrencyState] = useState<string>('USD');

  useEffect(() => {
    const saved = localStorage.getItem('display-currency');
    if (saved) {
      setSelectedCurrencyState(saved);
    }
  }, []);

  const setSelectedCurrency = (currency: string) => {
    setSelectedCurrencyState(currency);
    localStorage.setItem('display-currency', currency);
  };

  const value = useMemo(() => ({ selectedCurrency, setSelectedCurrency }), [selectedCurrency]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
