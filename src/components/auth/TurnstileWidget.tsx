
import { useEffect, useRef, useState } from 'react';

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  className?: string;
  refreshExpired?: boolean;
}

export function TurnstileWidget({ 
  onVerify, 
  className = '', 
  refreshExpired = true 
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    
    if (!turnstileSiteKey) {
      console.error('Turnstile site key not configured');
      setError('CAPTCHA service not configured');
      setIsLoading(false);
      return;
    }

    // Load Turnstile script if not already loaded
    if (!window.turnstile) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      
      script.onload = () => renderWidget(turnstileSiteKey);
      script.onerror = () => {
        console.error('Failed to load Turnstile script');
        setError('Failed to load security verification');
        setIsLoading(false);
      };
      
      document.head.appendChild(script);
    } else {
      renderWidget(turnstileSiteKey);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  const renderWidget = (siteKey: string) => {
    if (!containerRef.current || !window.turnstile) {
      setError('Failed to initialize security verification');
      setIsLoading(false);
      return;
    }

    try {
      // Remove any existing widget
      if (widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }

      // Clear the container
      containerRef.current.innerHTML = '';

      // Render new widget
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          onVerify(token);
        },
        'expired-callback': () => {
          if (refreshExpired) {
            window.turnstile.reset(widgetIdRef.current);
          }
        }
      });

      setIsLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error rendering Turnstile widget:', err);
      setError('Error loading security verification');
      setIsLoading(false);
    }
  };

  return (
    <div className={`turnstile-container ${className}`}>
      {isLoading && <div className="text-sm text-muted-foreground">Loading security verification...</div>}
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div ref={containerRef} className="turnstile-widget"></div>
    </div>
  );
}
