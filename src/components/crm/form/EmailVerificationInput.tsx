import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, HelpCircle, Mail, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface EmailVerificationInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidationResult?: (result: { valid: boolean; data?: any }) => void;
  className?: string;
  label?: string;
  placeholder?: string;
}

export function EmailVerificationInput({ 
  value, 
  onChange, 
  onValidationResult, 
  className,
  label = 'Email',
  placeholder = 'email@example.com'
}: EmailVerificationInputProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ 
    valid: boolean; 
    message?: string;
    result?: string;
    score?: number;
    disposable?: boolean;
  } | null>(null);

  const handleValidate = async () => {
    if (!value || !value.includes('@')) return;

    setIsValidating(true);
    setValidationResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('validate-vat-eori', {
        body: {
          action: 'validate_email',
          email: value,
        },
      });

      if (error) throw error;

      let message = '';
      if (data?.verified) {
        if (data.result === 'deliverable') {
          message = '✓ Valid email address';
        } else if (data.result === 'risky') {
          message = '⚠ Email may be risky';
        } else if (data.result === 'undeliverable') {
          message = '✗ Email appears undeliverable';
        } else {
          message = `Status: ${data.result}`;
        }
        if (data.disposable) {
          message += ' (disposable)';
        }
      } else if (data?.format_valid) {
        message = data.note || '✓ Valid format';
      } else {
        message = data?.error || 'Invalid email';
      }

      const result = {
        valid: data?.valid || false,
        message,
        result: data?.result,
        score: data?.score,
        disposable: data?.disposable,
      };

      setValidationResult(result);
      onValidationResult?.({ valid: result.valid, data });
    } catch (err) {
      console.error('Email validation error:', err);
      setValidationResult({ valid: false, message: 'Validation service unavailable' });
    } finally {
      setIsValidating(false);
    }
  };

  const getStatusIcon = () => {
    if (!validationResult) return null;
    
    if (validationResult.result === 'risky' || validationResult.disposable) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    
    return validationResult.valid ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-destructive" />
    );
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-1.5">
        <Label className="text-xs">{label}</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-48">
              Verify email deliverability using Hunter.io
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Mail className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="email"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setValidationResult(null);
            }}
            placeholder={placeholder}
            className={cn(
              'pl-8 pr-8',
              validationResult?.valid === true && 'border-green-500',
              validationResult?.valid === false && 'border-destructive',
              validationResult?.result === 'risky' && 'border-yellow-500'
            )}
          />
          {validationResult && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {getStatusIcon()}
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleValidate}
          disabled={isValidating || !value || !value.includes('@')}
          className="shrink-0"
        >
          {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
        </Button>
      </div>

      {validationResult?.message && (
        <p className={cn(
          'text-xs',
          validationResult.valid ? 'text-green-600' : 'text-destructive',
          validationResult.result === 'risky' && 'text-yellow-600'
        )}>
          {validationResult.message}
        </p>
      )}
      
      {validationResult?.score !== undefined && (
        <p className="text-xs text-muted-foreground">
          Confidence score: {validationResult.score}%
        </p>
      )}
    </div>
  );
}
