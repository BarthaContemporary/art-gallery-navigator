
import React, { useEffect, useRef, useState, useCallback } from 'react';
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
const SCRIPT_ID = 'turnstile-cloudflare-script';

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
  const [isMounted, setIsMounted] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  // Stable callbacks
  const stableOnVerify = useCallback((token: string) => {
    logger.log('TurnstileWidget: Token received:', token ? 'present' : 'missing');
    onVerify(token);
  }, [onVerify]);

  const stableOnError = useCallback(() => {
    logger.error('TurnstileWidget: Error callback triggered');
    if (onError) onError();
  }, [onError]);

  const stableOnExpire = useCallback(() => {
    logger.warn('TurnstileWidget: Expire callback triggered');
    if (onExpire) onExpire();
  }, [onExpire]);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  
  // Load Turnstile script
  useEffect(() => {
    if (!siteKey) {
      logger.error("TurnstileWidget: siteKey is not provided");
      stableOnError();
      return;
    }

    if (window.turnstile) {
      if (isMounted) setScriptLoaded(true);
      return;
    }

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    const handleLoad = () => {
      logger.log('TurnstileWidget: Script loaded successfully');
      if (isMounted) setScriptLoaded(true);
    };

    const handleError = () => {
      logger.error('TurnstileWidget: Failed to load script');
      stableOnError();
    };

    if (script) {
      if (window.turnstile) {
        if (isMounted) setScriptLoaded(true);
      } else {
        script.addEventListener('load', handleLoad);
        script.addEventListener('error', handleError);
      }
    } else {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.addEventListener('load', handleLoad);
      script.addEventListener('error', handleError);
      document.head.appendChild(script);
    }
    
    return () => {
      if (script) {
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
      }
    };
  }, [siteKey, stableOnError, isMounted]);

  // Render widget
  useEffect(() => {
    if (!scriptLoaded || !window.turnstile || !ref.current || !isMounted || isRendering) {
      return;
    }

    const container = ref.current;
    
    // Prevent multiple renders
    setIsRendering(true);

    // Clean up existing widget
    if (widgetId) {
      try {
        window.turnstile.remove(widgetId);
        logger.log('TurnstileWidget: Previous widget removed:', widgetId);
      } catch (e) {
        logger.warn('TurnstileWidget: Error removing previous widget:', e);
      }
      setWidgetId(undefined);
    }
    
    // Clear container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    try {
      logger.log('TurnstileWidget: Rendering widget with siteKey:', siteKey);
      
      const newWidgetId = window.turnstile.render(container, {
        sitekey: siteKey,
        action: action,
        callback: stableOnVerify,
        'error-callback': stableOnError,
        'expired-callback': stableOnExpire,
        theme: theme,
        'refresh-expired': 'auto',
      });
      
      if (newWidgetId) {
        logger.log('TurnstileWidget: Widget rendered successfully with ID:', newWidgetId);
        setWidgetId(newWidgetId);
      } else {
        logger.error('TurnstileWidget: Widget render returned no ID');
        stableOnError();
      }
    } catch (e) {
      logger.error('TurnstileWidget: Exception during render:', e);
      stableOnError();
    } finally {
      setIsRendering(false);
    }

    return () => {
      if (widgetId && window.turnstile && isMounted) {
        try {
          logger.log('TurnstileWidget: Cleaning up widget:', widgetId);
          window.turnstile.remove(widgetId);
        } catch (e) {
          logger.warn('TurnstileWidget: Error during cleanup:', e);
        }
      }
    };
  }, [scriptLoaded, siteKey, action, theme, stableOnVerify, stableOnError, stableOnExpire, isMounted, isRendering]);

  return (
    <div className="turnstile-container">
      <div ref={ref} />
      {!scriptLoaded && (
        <div className="text-sm text-gray-500">Loading security verification...</div>
      )}
    </div>
  );
};
