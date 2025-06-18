
import { useEffect, useRef, useState } from 'react';

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  className?: string;
  refreshExpired?: boolean;
}

// Use the fallback site key from custom instructions
const FALLBACK_TURNSTILE_SITE_KEY = "0x4AAAAAABVNY-RtAZWQwtdF";

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
    // Get the Turnstile site key from environment variable or use fallback
    const envSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    const turnstileSiteKey = envSiteKey || FALLBACK_TURNSTILE_SITE_KEY;
    
    console.log('Turnstile configuration check:', {
      envVarPresent: !!envSiteKey,
      envVarValue: envSiteKey ? `${envSiteKey.substring(0, 8)}...` : 'undefined',
      usingFallback: !envSiteKey,
      finalSiteKey: turnstileSiteKey ? `${turnstileSiteKey.substring(0, 8)}...` : 'undefined'
    });
    
    if (!turnstileSiteKey) {
      console.error('No Turnstile site key available (neither env var nor fallback)');
      setError('Security verification is not configured. Please contact support.');
      setIsLoading(false);
      return;
    }

    // Load Turnstile script if not already loaded
    if (!window.turnstile) {
      console.log('Loading Turnstile script...');
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        console.log('Turnstile script loaded successfully');
        renderWidget(turnstileSiteKey);
      };
      
      script.onerror = () => {
        console.error('Failed to load Turnstile script');
        setError('Failed to load security verification service');
        setIsLoading(false);
      };
      
      document.head.appendChild(script);
    } else {
      console.log('Turnstile script already loaded, rendering widget');
      renderWidget(turnstileSiteKey);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        } catch (err) {
          console.warn('Error removing Turnstile widget:', err);
        }
      }
    };
  }, []);

  const renderWidget = (siteKey: string) => {
    if (!containerRef.current || !window.turnstile) {
      console.error('Cannot render widget: container or turnstile not available');
      setError('Failed to initialize security verification');
      setIsLoading(false);
      return;
    }

    try {
      console.log('Rendering Turnstile widget with site key:', `${siteKey.substring(0, 8)}...`);
      
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
          console.log('Turnstile verification successful');
          onVerify(token);
        },
        'expired-callback': () => {
          console.log('Turnstile token expired');
          if (refreshExpired) {
            window.turnstile.reset(widgetIdRef.current);
          }
        },
        'error-callback': () => {
          console.error('Turnstile verification error');
          setError('Security verification failed. Please refresh the page and try again.');
        }
      });

      setIsLoading(false);
      setError(null);
      console.log('Turnstile widget rendered successfully');
    } catch (err) {
      console.error('Error rendering Turnstile widget:', err);
      setError('Error loading security verification');
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <div className={`turnstile-container ${className}`}>
        <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-md border border-destructive/20">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className={`turnstile-container ${className}`}>
      {isLoading && (
        <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">
          Loading security verification...
        </div>
      )}
      <div ref={containerRef} className="turnstile-widget"></div>
    </div>
  );
}
