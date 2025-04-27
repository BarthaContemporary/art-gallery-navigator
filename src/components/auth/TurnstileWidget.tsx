
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
  const attemptRef = useRef<number>(0);
  const maxRetries = 3;

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
        attemptRef.current += 1;
        console.log(`Rendering Turnstile widget... (attempt ${attemptRef.current})`);
        
        // Get and log domain information for debugging
        const currentDomain = window.location.hostname;
        const fullUrl = window.location.href;
        console.log(`Debug - Current domain: ${currentDomain}`);
        console.log(`Debug - Full URL: ${fullUrl}`);
        console.log(`Debug - Origin: ${window.location.origin}`);
        
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            console.log(`CAPTCHA verified successfully - token length: ${token.length}`);
            setLoadError(null);
            onVerify(token);
          },
          'error-callback': (errorCode: string) => {
            console.error(`CAPTCHA verification failed with code: ${errorCode}`);
            setLoadError(`Verification failed (${errorCode}). Please try again.`);
            
            if (onError) onError(new Error(`CAPTCHA verification failed: ${errorCode}`));
            
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
          },
          // Pass current hostname as domain info for verification
          'execution-domain': currentDomain,
          'data-domain': currentDomain,
          'data-action': 'login',
          'data-cdata': window.location.origin // Add domain info for verification
        });
        setIsLoading(false);
      } catch (error) {
        console.error('Error rendering Turnstile widget:', error);
        setLoadError(attemptRef.current >= maxRetries 
          ? 'Failed to load CAPTCHA. Please refresh the page or try a different browser.' 
          : 'Failed to load CAPTCHA. Retrying...');
        
        if (onError) onError(error instanceof Error ? error : new Error('Failed to render CAPTCHA'));
        
        // Try to reload if under max attempts
        if (attemptRef.current < maxRetries) {
          setTimeout(() => {
            console.log(`Retrying widget render (${attemptRef.current}/${maxRetries})...`);
            renderWidget();
          }, 2000);
        }
      }
    }
  };

  useEffect(() => {
    if (!scriptLoadedRef.current) {
      const existingScript = document.querySelector('script[src*="turnstile"]');
      
      if (!existingScript) {
        const script = document.createElement('script');
        // Use explicit rendering to have more control
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
