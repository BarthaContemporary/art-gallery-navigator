import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SanctionsMatch {
  id: string;
  caption: string;
  schema: string;
  score: number;
  match: boolean;
  datasets: string[];
  properties: Record<string, string[]>;
}

export interface SanctionsCheckResult {
  checked: boolean;
  checked_at?: string;
  name_checked?: string;
  has_matches: boolean;
  high_confidence_match: boolean;
  match_count: number;
  matches: SanctionsMatch[];
  risk_level: 'high' | 'medium' | 'clear';
  error?: string;
  api_error?: boolean;
}

export function useSanctionsCheck() {
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<SanctionsCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkSanctions = async (params: {
    name: string;
    birthDate?: string;
    nationality?: string;
    country?: string;
  }) => {
    setIsChecking(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('check-sanctions', {
        body: params,
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        setError(data.error);
        setResult(data);
      } else {
        setResult(data);
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sanctions check failed';
      setError(message);
      return { checked: false, error: message };
    } finally {
      setIsChecking(false);
    }
  };

  const clearResult = () => {
    setResult(null);
    setError(null);
  };

  return {
    checkSanctions,
    clearResult,
    isChecking,
    result,
    error,
  };
}
