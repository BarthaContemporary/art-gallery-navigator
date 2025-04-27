
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
            console.log('CAPTCHA verified successfully');
            setLoadError(null);
            onVerify(token);
          },
          'error-callback': () => {
            const error = new Error('CAPTCHA verification failed');
            console.error('CAPTCHA verification failed');
            setLoadError('Verification failed. Please try again.');
            if (onError) onError(error);
            // Auto-reset after error
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
        script.onerror = () => {
          console.error('Failed to load Turnstile script');
          setLoadError('Failed to load CAPTCHA. Please refresh the page.');
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
      <div 
        ref={containerRef} 
        className="flex justify-center my-4" 
        data-turnstile
      />
      {isLoading && (
        <div className="text-muted-foreground text-sm">Loading CAPTCHA verification...</div>
      )}
      {loadError && (
        <div className="text-destructive text-sm">{loadError}</div>
      )}
    </div>
  );
}
