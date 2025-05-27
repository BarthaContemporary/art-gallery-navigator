
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
const SCRIPT_ID = 'turnstile-cloudflare-script'; // Unique ID for the script tag

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

  // Stable callbacks
  const stableOnVerify = useCallback(onVerify, [onVerify]);
  const stableOnError = useCallback(() => { if (onError) onError(); }, [onError]);
  const stableOnExpire = useCallback(() => { if (onExpire) onExpire(); }, [onExpire]);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  
  // Load Turnstile script only once per page
  useEffect(() => {
    if (!siteKey) {
      logger.error("TurnstileWidget: siteKey is not provided. Widget will not render.");
      stableOnError(); // Call error callback if siteKey is missing
      return;
    }

    if (window.turnstile) {
      if (isMounted) setScriptLoaded(true);
      return;
    }

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    const handleLoad = () => {
      logger.log('Turnstile script loaded successfully.');
      if (isMounted) setScriptLoaded(true);
      if (script) {
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
      }
    };

    const handleError = () => {
      logger.error('Failed to load Turnstile script.');
      stableOnError();
      if (script) {
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
      }
    };

    if (script) { // Script tag exists
      // If window.turnstile is not yet there, it might be loading. Add listeners.
      // Check if it has already loaded (e.g. race condition)
      if (window.turnstile) {
         if (isMounted) setScriptLoaded(true);
      } else {
        script.addEventListener('load', handleLoad);
        script.addEventListener('error', handleError);
      }
    } else { // Script tag does not exist, create and append
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.addEventListener('load', handleLoad);
      script.addEventListener('error', handleError);
      document.head.appendChild(script);
    }
    
    // Cleanup: remove event listeners specific to this instance's attempt to load script
    // The script tag itself is NOT removed, to allow it to be shared.
    return () => {
      if (script) {
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
      }
    };
  }, [siteKey, stableOnError, isMounted]);

  // Render and manage widget instance
  useEffect(() => {
    if (!scriptLoaded || !window.turnstile || !ref.current || !isMounted) {
      return;
    }

    const container = ref.current;
    let renderedWidgetId: string | undefined = undefined;

    // If a widget was previously rendered by this instance, remove it first.
    // This handles re-renders due to prop changes (like theme, action).
    if (widgetId) {
      try {
        window.turnstile.remove(widgetId);
        logger.log('TurnstileWidget: Previous widget removed due to re-render:', widgetId);
      } catch (e) {
        logger.warn('TurnstileWidget: Error removing existing widget on re-render:', e);
      }
      // setWidgetId(undefined); // Clear it before rendering new one
    }
    
    // Clear the container explicitly before rendering.
    // This helps if a previous widget was left orphaned by another instance or error.
    // However, be cautious as Turnstile might expect to manage its own iframe.
    // A less invasive way is to ensure no other elements are in our specific ref.current
    while(container.firstChild) {
        container.removeChild(container.firstChild);
    }


    try {
      logger.log('TurnstileWidget: Rendering Turnstile widget. Sitekey:', siteKey, 'Action:', action, 'Theme:', theme);
      renderedWidgetId = window.turnstile.render(container, {
        sitekey: siteKey,
        action: action,
        callback: stableOnVerify,
        'error-callback': stableOnError,
        'expired-callback': stableOnExpire,
        theme: theme,
        'refresh-expired': 'auto', // Automatically manage token expiration
      });
      
      if (renderedWidgetId) {
        logger.log('Turnstile widget rendered successfully with ID:', renderedWidgetId);
        if (isMounted) setWidgetId(renderedWidgetId);
      } else {
        logger.error('Turnstile widget render call did not return an ID.');
        stableOnError();
      }
    } catch (e) {
      logger.error('TurnstileWidget: Exception during Turnstile widget render:', e);
      stableOnError();
    }

    return () => {
      // Cleanup function: Only remove the widget if this effect instance successfully rendered it.
      if (renderedWidgetId && window.turnstile && isMounted) {
        try {
          logger.log('TurnstileWidget: Removing widget during cleanup:', renderedWidgetId);
          window.turnstile.remove(renderedWidgetId);
        } catch (e) {
          logger.warn('TurnstileWidget: Error removing widget during cleanup:', e);
        }
      } else if (widgetId && window.turnstile && isMounted) {
        // Fallback for the current widgetId if renderedWidgetId was not set in this run
        // This might happen if the component unmounts before new ID is set or due to an error
        try {
          logger.log('TurnstileWidget: Removing widget (state widgetId) during cleanup:', widgetId);
          window.turnstile.remove(widgetId);
        } catch (e) {
          logger.warn('TurnstileWidget: Error removing widget (state widgetId) during cleanup:', e);
        }
      }
      // When the component unmounts or dependencies change, ensure widgetId state is cleared if appropriate
      // This is implicitly handled if new widget is rendered or component unmounts.
      // if (isMounted) setWidgetId(undefined); // This could be too aggressive if simply re-rendering
    };
  // Add all dependencies that, if changed, should trigger a re-render of the widget.
  // stableOnVerify, stableOnError, stableOnExpire are used to ensure callbacks don't cause unnecessary re-renders.
  }, [scriptLoaded, siteKey, action, theme, stableOnVerify, stableOnError, stableOnExpire, isMounted]);
  // Note: widgetId was removed from dependencies to prevent re-render loops from setWidgetId.
  // The logic now handles removing the "previous" widgetId at the start of the effect if it exists.

  return <div ref={ref} className="turnstile-container" />;
};

