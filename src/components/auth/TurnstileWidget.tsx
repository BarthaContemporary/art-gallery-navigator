
import React, { useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';

interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  action?: string;
  theme?: 'light' | 'dark' | 'auto';
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback';

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  siteKey,
  onVerify,
  onError,
  onExpire,
  action,
  theme = 'auto',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [widgetId, setWidgetId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let script: HTMLScriptElement | null = null;
    let timeoutId: number | null = null;

    const loadScript = () => {
      if (window.turnstile) {
        renderWidget();
        return;
      }

      script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;

      (window as any).onloadTurnstileCallback = () => {
        logger.log('Turnstile script loaded.');
        renderWidget();
      };

      script.onerror = () => {
        logger.error('Failed to load Turnstile script.');
        if (onError) onError();
      };

      document.head.appendChild(script);
    };

    const renderWidget = () => {
      if (!ref.current || !window.turnstile || !siteKey) {
        logger.warn('Turnstile widget prerequisites not met.', {
          ref: !!ref.current,
          turnstile: !!window.turnstile,
          siteKey: !!siteKey,
        });
        if (widgetId) { // Clean up if already rendered but prerequisites fail later
          window.turnstile.remove(widgetId);
          setWidgetId(undefined);
        }
        return;
      }

      // Ensure not to re-render if widgetId already exists for this instance
      if (widgetId) {
          // Potentially reset if needed, or just ensure it's still valid
          // For now, we assume if widgetId exists, it's managed.
          // window.turnstile.reset(widgetId);
          return;
      }
      
      logger.log('Rendering Turnstile widget with sitekey:', siteKey);
      try {
        const newWidgetId = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          action: action,
          callback: (token: string) => {
            logger.log('Turnstile verified:', token ? 'Token received' : 'No token');
            onVerify(token);
          },
          'error-callback': () => {
            logger.error('Turnstile error callback triggered.');
            if (onError) onError();
          },
          'expired-callback': () => {
            logger.warn('Turnstile expired callback triggered.');
            if (onExpire) onExpire();
          },
          theme: theme,
        });
        setWidgetId(newWidgetId);
      } catch (e) {
        logger.error('Error rendering Turnstile widget:', e);
        if (onError) onError();
      }
    };
    
    // Check for siteKey before attempting to load script/render
    if (!siteKey) {
      logger.error("Turnstile siteKey is not provided. Widget will not render.");
      if (onError) onError(); // Notify parent about the configuration error
      return;
    }

    // Script loading and rendering logic
    if (document.readyState === 'complete') {
      loadScript();
    } else {
      window.addEventListener('load', loadScript);
    }
    
    // Debounce rendering attempt for a short period to handle race conditions
    timeoutId = window.setTimeout(renderWidget, 100);


    return () => {
      if (script) {
        document.head.removeChild(script);
      }
      if (widgetId && window.turnstile) {
        logger.log('Removing Turnstile widget:', widgetId);
        window.turnstile.remove(widgetId);
      }
      if ((window as any).onloadTurnstileCallback) {
        delete (window as any).onloadTurnstileCallback;
      }
      window.removeEventListener('load', loadScript);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [siteKey, onVerify, onError, onExpire, action, theme]); // Removed widgetId from deps

  return <div ref={ref} />;
};
