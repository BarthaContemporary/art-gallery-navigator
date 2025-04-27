
import { useEffect, useRef } from 'react';

interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: (error: Error) => void;
}

export function TurnstileWidget({ siteKey, onVerify, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const scriptLoadedRef = useRef<boolean>(false);

  useEffect(() => {
    // Function to render the widget when script is loaded
    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile) return;
      
      // If we already have a widget ID but the container is empty, reset the widget ID
      if (widgetIdRef.current && containerRef.current.children.length === 0) {
        widgetIdRef.current = null;
      }
      
      // Only render if we don't already have a widget ID
      if (!widgetIdRef.current) {
        try {
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              onVerify(token);
            },
            'error-callback': () => {
              if (onError) onError(new Error('CAPTCHA verification failed'));
            }
          });
        } catch (error) {
          console.error('Error rendering Turnstile widget:', error);
          if (onError) onError(error instanceof Error ? error : new Error('Failed to render CAPTCHA'));
        }
      }
    };

    // Load script if it hasn't been loaded yet
    if (!scriptLoadedRef.current) {
      const existingScript = document.querySelector('script[src*="turnstile"]');
      
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          scriptLoadedRef.current = true;
          renderWidget();
        };
        document.head.appendChild(script);
      } else {
        scriptLoadedRef.current = true;
        // If the script is already in the document but not loaded yet
        existingScript.addEventListener('load', renderWidget);
        // If the script is already loaded
        if (window.turnstile) {
          renderWidget();
        }
      }
    } else if (window.turnstile) {
      // Script is loaded, render widget
      renderWidget();
    }

    return () => {
      // Cleanup when component unmounts
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch (e) {
          console.error('Error resetting Turnstile widget:', e);
        }
      }
    };
  }, [siteKey, onVerify, onError]);

  return (
    <div className="flex flex-col items-center w-full">
      <div ref={containerRef} className="flex justify-center my-4" data-turnstile></div>
      {!scriptLoadedRef.current && (
        <div className="text-muted-foreground text-xs">Loading CAPTCHA...</div>
      )}
    </div>
  );
}
