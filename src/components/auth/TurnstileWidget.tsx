
import { useEffect, useRef, useState } from 'react';

interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: (error: Error) => void;
}

export function TurnstileWidget({ siteKey, onVerify, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const scriptLoadedRef = useRef<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const resetWidget = () => {
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
        console.log('CAPTCHA widget reset');
      } catch (error) {
        console.error('Error resetting Turnstile widget:', error);
      }
    }
  };

  const renderWidget = () => {
    if (!containerRef.current || !window.turnstile) {
      console.log('Container or Turnstile not ready');
      return;
    }
    
    if (widgetIdRef.current && containerRef.current.children.length === 0) {
      widgetIdRef.current = null;
    }
    
    if (!widgetIdRef.current) {
      try {
        console.log('Rendering Turnstile widget...');
        
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            console.log('CAPTCHA token generated');
            setLoadError(null);
            // Immediately notify parent component of the token
            onVerify(token);
          },
          'error-callback': (errorCode: string) => {
            console.error(`CAPTCHA error: ${errorCode}`);
            setLoadError(`Verification failed (${errorCode}). Please try again.`);
            
            if (onError) onError(new Error(`CAPTCHA error: ${errorCode}`));
            setTimeout(resetWidget, 1500);
          },
          'timeout-callback': () => {
            console.log('CAPTCHA timeout - resetting');
            setLoadError('Verification timed out. Please try again.');
            resetWidget();
          },
          'expired-callback': () => {
            console.log('CAPTCHA expired - resetting');
            setLoadError('Verification expired. Please try again.');
            resetWidget();
          }
        });
        setIsLoading(false);
      } catch (error) {
        console.error('Error rendering Turnstile widget:', error);
        setLoadError('Failed to load CAPTCHA. Please refresh the page.');
        if (onError) onError(error instanceof Error ? error : new Error('Failed to render CAPTCHA'));
      }
    }
  };

  useEffect(() => {
    if (!scriptLoadedRef.current) {
      const existingScript = document.querySelector('script[src*="turnstile"]');
      
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          console.log('Turnstile script loaded');
          scriptLoadedRef.current = true;
          setIsLoading(false);
          renderWidget();
        };
        script.onerror = (e) => {
          console.error('Failed to load Turnstile script:', e);
          setLoadError('Failed to load CAPTCHA. Please check your connection and refresh the page.');
          setIsLoading(false);
        };
        document.head.appendChild(script);
      } else {
        scriptLoadedRef.current = true;
        if (window.turnstile) {
          setIsLoading(false);
          renderWidget();
        }
      }
    } else if (window.turnstile) {
      renderWidget();
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          console.error('Error cleaning up Turnstile widget:', e);
        }
      }
    };
  }, [siteKey]);

  return (
    <div className="flex flex-col items-center w-full space-y-2">
      {loadError && (
        <div className="text-destructive text-sm mb-2">{loadError}</div>
      )}
      <div 
        ref={containerRef} 
        className="flex justify-center my-4" 
        data-turnstile
      />
      {isLoading && (
        <div className="text-muted-foreground text-sm">Loading CAPTCHA verification...</div>
      )}
    </div>
  );
}
