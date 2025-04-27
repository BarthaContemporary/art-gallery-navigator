
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

  useEffect(() => {
    let scriptLoaded = false;

    // Function to render the widget when script is loaded
    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile || scriptLoaded) return;
      
      scriptLoaded = true;
      
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            onVerify(token);
          },
        });
      } catch (error) {
        console.error('Error rendering Turnstile widget:', error);
      }
    };

    // Create and load the script
    const script = document.createElement('script');
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = renderWidget;
    document.head.appendChild(script);

    // Check if script is already loaded
    if (window.turnstile) {
      renderWidget();
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch (e) {
          console.error('Error resetting Turnstile widget:', e);
        }
      }
      document.head.removeChild(script);
    };
  }, [siteKey, onVerify]);

  return <div ref={containerRef} className="flex justify-center my-4"></div>;
}
