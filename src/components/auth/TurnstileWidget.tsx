
import { useEffect } from 'react';

declare global {
  interface Window {
    turnstile: {
      render: (container: string | HTMLElement, options: any) => Promise<string>;
      reset: (widgetId: string) => void;
    };
  }
}

export function TurnstileWidget() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return null;
}
