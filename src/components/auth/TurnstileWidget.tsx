
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

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

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
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Load Turnstile script only once
  useEffect(() => {
    if (!siteKey) {
      logger.error("TurnstileWidget: siteKey is not provided. Widget will not render.");
      if (onError) onError();
      return;
    }

    // Check if script is already loaded
    if (window.turnstile) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      logger.log('Turnstile script loaded successfully.');
      setScriptLoaded(true);
    };
    
    script.onerror = () => {
      logger.error('Failed to load Turnstile script.');
      if (onError) onError();
    };
    
    document.head.appendChild(script);
    
    return () => {
      // Only remove if we added it and it still exists
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [siteKey, onError]);

  // Render widget when script is loaded and container is ready
  useEffect(() => {
    // Don't render if script isn't loaded yet or ref isn't ready
    if (!scriptLoaded || !window.turnstile || !ref.current) {
      return;
    }

    // If widget already exists, reset it before creating a new one
    if (widgetId) {
      try {
        window.turnstile.remove(widgetId);
      } catch (e) {
        logger.warn('Error removing existing Turnstile widget:', e);
      }
    }

    try {
      logger.log('Rendering Turnstile widget with sitekey:', siteKey);
      const newWidgetId = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        action: action,
        callback: (token: string) => {
          logger.log('Turnstile verified. Token received.');
          onVerify(token);
        },
        'error-callback': () => {
          logger.error('Turnstile error-callback triggered.');
          if (onError) onError();
        },
        'expired-callback': () => {
          logger.warn('Turnstile expired-callback triggered.');
          if (onExpire) onExpire();
        },
        theme: theme,
        // Adding refresh expired tokens automatically
        'refresh-expired': 'auto'
      });
      
      if (newWidgetId) {
        logger.log('Turnstile widget rendered successfully with ID:', newWidgetId);
        setWidgetId(newWidgetId);
      }
    } catch (e) {
      logger.error('Exception during Turnstile widget render:', e);
      if (onError) onError();
    }

    return () => {
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch (e) {
          logger.warn('Error removing Turnstile widget during cleanup:', e);
        }
      }
    };
  }, [scriptLoaded, siteKey, action, theme, onVerify, onError, onExpire]);

  return <div ref={ref} className="turnstile-container" />;
};
