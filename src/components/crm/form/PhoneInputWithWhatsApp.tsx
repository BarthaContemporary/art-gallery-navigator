import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Phone, Smartphone, MessageCircle, Loader2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useWhatsAppCheck } from '@/hooks/crm/use-whatsapp-check';

interface PhoneInputWithWhatsAppProps {
  landlineValue: string;
  mobileValue: string;
  whatsappValue: string;
  onLandlineChange: (value: string) => void;
  onMobileChange: (value: string) => void;
  onWhatsappChange: (value: string) => void;
  className?: string;
}

export function PhoneInputWithWhatsApp({
  landlineValue,
  mobileValue,
  whatsappValue,
  onLandlineChange,
  onMobileChange,
  onWhatsappChange,
  className,
}: PhoneInputWithWhatsAppProps) {
  const { checkWhatsApp, isLoading, result, resetResult } = useWhatsAppCheck();
  const [hasChecked, setHasChecked] = useState(false);

  const handleCheckWhatsApp = async () => {
    if (!mobileValue) return;
    
    const checkResult = await checkWhatsApp(mobileValue);
    setHasChecked(true);
    
    if (checkResult?.exists && !whatsappValue) {
      // Auto-fill WhatsApp with mobile number if check passes
      onWhatsappChange(mobileValue);
    }
  };

  // Reset check state when mobile number changes
  useEffect(() => {
    setHasChecked(false);
    resetResult();
  }, [mobileValue]);

  return (
    <div className={cn('col-span-2 grid grid-cols-2 gap-4', className)}>
      {/* Landline Phone */}
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1.5">
          <Phone className="h-3 w-3" />
          Phone (Landline)
        </Label>
        <Input
          type="tel"
          value={landlineValue}
          onChange={(e) => onLandlineChange(e.target.value)}
          placeholder="+44 20 1234 5678"
        />
      </div>

      {/* Mobile Phone with WhatsApp check */}
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1.5">
          <Smartphone className="h-3 w-3" />
          Mobile
        </Label>
        <div className="flex gap-2">
          <Input
            type="tel"
            value={mobileValue}
            onChange={(e) => onMobileChange(e.target.value)}
            placeholder="+44 7700 123456"
            className={cn(
              'flex-1',
              hasChecked && result?.exists && 'border-green-500'
            )}
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCheckWhatsApp}
                  disabled={isLoading || !mobileValue || mobileValue.length < 8}
                  className={cn(
                    'shrink-0 h-9 w-9',
                    hasChecked && result?.exists && 'border-green-500 text-green-500'
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : hasChecked && result?.exists ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <MessageCircle className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Check WhatsApp availability</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {hasChecked && result && (
          <p className={cn(
            'text-xs',
            result.exists ? 'text-green-600' : 'text-muted-foreground'
          )}>
            {result.exists ? 'Valid mobile format - WhatsApp likely available' : 'Number format may not support WhatsApp'}
          </p>
        )}
      </div>
    </div>
  );
}
