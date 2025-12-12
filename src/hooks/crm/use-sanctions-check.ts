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
    contactId: string;
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
        body: {
          name: params.name,
          birthDate: params.birthDate,
          nationality: params.nationality,
          country: params.country,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        setError(data.error);
        setResult(data);
      } else {
        setResult(data);
        
        // Save results to the contact record
        const { error: updateError } = await supabase
          .from('crm_contacts')
          .update({
            sanctions_checked_at: new Date().toISOString(),
            sanctions_risk_level: data.risk_level,
            sanctions_match_count: data.match_count || 0,
            sanctions_matches: data.matches || [],
          })
          .eq('id', params.contactId);
        
        if (updateError) {
          console.error('Failed to save sanctions check result:', updateError);
        }
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

  const loadSavedResult = (contact: {
    sanctions_checked_at?: string | null;
    sanctions_risk_level?: string | null;
    sanctions_match_count?: number | null;
    sanctions_matches?: SanctionsMatch[] | null;
  }) => {
    if (contact.sanctions_checked_at) {
      const savedResult: SanctionsCheckResult = {
        checked: true,
        checked_at: contact.sanctions_checked_at,
        risk_level: (contact.sanctions_risk_level as 'high' | 'medium' | 'clear') || 'clear',
        match_count: contact.sanctions_match_count || 0,
        matches: (contact.sanctions_matches as SanctionsMatch[]) || [],
        has_matches: (contact.sanctions_match_count || 0) > 0,
        high_confidence_match: ((contact.sanctions_matches as SanctionsMatch[]) || []).some(m => m.score >= 0.9),
      };
      setResult(savedResult);
    }
  };

  const clearResult = () => {
    setResult(null);
    setError(null);
  };

  return {
    checkSanctions,
    loadSavedResult,
    clearResult,
    isChecking,
    result,
    error,
  };
}
