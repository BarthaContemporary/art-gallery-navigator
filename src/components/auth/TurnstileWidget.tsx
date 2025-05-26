
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
    let timeoutId: number | null = null; // Renamed for clarity, was `NodeJS.Timeout`

    const loadScript = () => {
      if (window.turnstile) {
        logger.debug('Turnstile script already available.');
        renderWidget();
        return;
      }

      logger.debug('Loading Turnstile script.');
      script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;

      (window as any).onloadTurnstileCallback = () => {
        logger.log('Turnstile script loaded via onloadTurnstileCallback.');
        renderWidget();
      };

      script.onerror = () => {
        logger.error('Failed to load Turnstile script from URL:', SCRIPT_URL);
        if (onError) onError();
      };

      document.head.appendChild(script);
    };

    const renderWidget = () => {
      if (!ref.current || !window.turnstile || !siteKey) {
        logger.warn('Turnstile widget prerequisites not met for rendering.', {
          hasRef: !!ref.current,
          hasWindowTurnstile: !!window.turnstile,
          hasSiteKey: !!siteKey,
        });
        // Clean up if widget was previously rendered but prerequisites (e.g. ref) fail now
        if (widgetId && window.turnstile) {
          logger.warn('Attempting to remove existing widget due to failed prerequisites for re-render.', { widgetId });
          window.turnstile.remove(widgetId);
          setWidgetId(undefined);
        }
        return;
      }

      if (widgetId) {
        logger.debug('Turnstile widget already rendered with ID:', widgetId, 'Skipping re-render.');
        // Consider if reset is needed: window.turnstile.reset(widgetId);
        return;
      }
      
      logger.log('Rendering Turnstile widget with sitekey:', siteKey, 'Action:', action, 'Theme:', theme);
      try {
        const newWidgetId = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          action: action,
          callback: (token: string) => {
            logger.log('Turnstile verified. Token length:', token?.length);
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
        });
        if (newWidgetId) {
          logger.log('Turnstile widget rendered successfully. New Widget ID:', newWidgetId);
          setWidgetId(newWidgetId);
        } else {
          logger.error('Turnstile render call did not return a widget ID. Sitekey or container issue?');
          if (onError) onError(); // Propagate error if render fails to return ID
        }
      } catch (e) {
        logger.error('Exception during Turnstile widget render:', e);
        if (onError) onError();
      }
    };
    
    if (!siteKey) {
      logger.error("TurnstileWidget: siteKey is not provided. Widget will not render.");
      if (onError) onError(); 
      return;
    }

    // Using a small timeout to ensure the DOM element is ready and to handle potential race conditions.
    // Alternative: check document.readyState or use a 'load' event listener for the script itself.
    // onloadTurnstileCallback handles script load, so main concern is DOM element readiness.
    timeoutId = window.setTimeout(() => {
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        loadScript(); // Script handles its own loading and then calls renderWidget
      } else {
        // Fallback if component mounts very early
        window.addEventListener('DOMContentLoaded', loadScript, { once: true });
        logger.debug("TurnstileWidget: DOM not fully loaded, added DOMContentLoaded listener.");
      }
    }, 50); // Small delay


    return () => {
      logger.debug('TurnstileWidget: Cleanup effect running.', { widgetId });
      if (script && script.parentNode) {
        logger.debug('Removing Turnstile script element from head.');
        script.parentNode.removeChild(script);
      }
      if (widgetId && window.turnstile) {
        logger.log('Removing Turnstile widget instance:', widgetId);
        try {
          window.turnstile.remove(widgetId);
        } catch (e) {
          logger.warn('Error removing Turnstile widget during cleanup (might have already been removed):', e);
        }
      }
      if ((window as any).onloadTurnstileCallback) {
        logger.debug('Deleting onloadTurnstileCallback from window.');
        delete (window as any).onloadTurnstileCallback;
      }
      window.removeEventListener('DOMContentLoaded', loadScript);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [siteKey, action, theme, onVerify, onError, onExpire]); // widgetId removed from dependencies as it's internal state managed by the effect

  return <div ref={ref} id={`turnstile-container-${React.useId()}`} />;
};
