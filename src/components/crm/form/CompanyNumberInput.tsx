import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, HelpCircle, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface CompanyNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidationResult?: (result: { valid: boolean; data?: any }) => void;
  className?: string;
}

export function CompanyNumberInput({ value, onChange, onValidationResult, className }: CompanyNumberInputProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ 
    valid: boolean; 
    message?: string;
    companyName?: string;
    companyStatus?: string;
    isApiError?: boolean;
    isVerified?: boolean;
  } | null>(null);

  const handleValidate = async () => {
    if (!value || value.length < 4) return;

    setIsValidating(true);
    setValidationResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('validate-vat-eori', {
        body: {
          action: 'validate_company',
          company_number: value,
        },
      });

      if (error) throw error;

      const isApiError = data?.api_error === true;
      const isVerified = data?.verified === true;
      
      const result = {
        valid: data?.valid || false,
        message: data?.valid 
          ? (isVerified && data?.company_name 
              ? `✓ ${data.company_name}` 
              : (data?.note || '✓ Valid format'))
          : (data?.error || 'Validation failed'),
        companyName: data?.company_name,
        companyStatus: data?.company_status,
        isApiError,
        isVerified,
      };

      setValidationResult(result);
      onValidationResult?.({ valid: result.valid, data });
    } catch (err) {
      console.error('Validation error:', err);
      setValidationResult({ valid: false, message: 'Validation service unavailable' });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-1.5">
        <Label className="text-xs">Company Number</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-48">
              UK Companies House registration number (8 characters)
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={value}
            onChange={(e) => {
              onChange(e.target.value.toUpperCase());
              setValidationResult(null);
            }}
            placeholder="e.g., 12345678"
            className={cn(
              'pr-8 uppercase',
              validationResult?.valid === true && 'border-green-500',
              validationResult?.valid === false && 'border-destructive'
            )}
          />
          {validationResult && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {validationResult.valid ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleValidate}
          disabled={isValidating || !value || value.length < 4}
          className="shrink-0"
        >
          {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
        </Button>
      </div>

      {validationResult?.message && (
        <p className={cn(
          'text-xs',
          validationResult.isApiError ? 'text-amber-600' : 
          validationResult.valid ? 'text-green-600' : 'text-destructive'
        )}>
          {validationResult.message}
        </p>
      )}
      
      {validationResult?.companyStatus && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Building2 className="h-3 w-3" />
          Status: {validationResult.companyStatus}
        </p>
      )}
    </div>
  );
}
