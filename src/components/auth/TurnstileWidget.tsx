
import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile: {
      render: (container: string | HTMLElement, options: any) => string;
      reset: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
}

export function TurnstileWidget({ siteKey, onVerify }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const scriptAddedRef = useRef<boolean>(false);

  useEffect(() => {
    // If we already have a widget ID, we don't need to render again
    if (widgetIdRef.current) return;

    // Function to render the widget when script is loaded
    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile || containerRef.current.innerHTML.trim() === '') return;
      
      try {
        // Only render if we don't already have a widget ID
        if (!widgetIdRef.current) {
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              onVerify(token);
            },
          });
        }
      } catch (error) {
        console.error('Error rendering Turnstile widget:', error);
      }
    };

    // Create and load the script only once
    if (!scriptAddedRef.current && !document.querySelector('script[src*="turnstile"]')) {
      const script = document.createElement('script');
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
      scriptAddedRef.current = true;
    } else if (window.turnstile) {
      // If script is already loaded but we don't have a widget yet
      renderWidget();
    }

    return () => {
      // Only reset the widget when unmounting, don't remove the script
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
          widgetIdRef.current = null;
        } catch (e) {
          console.error('Error resetting Turnstile widget:', e);
        }
      }
    };
  }, [siteKey, onVerify]);

  return <div ref={containerRef} className="flex justify-center my-4"></div>;
}
