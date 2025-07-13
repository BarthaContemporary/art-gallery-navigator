import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { SecurityMonitor } from '@/utils/security-monitoring';
import { applySecurityHeaders, SECURITY_EVENT_TYPES } from '@/utils/security-headers';

interface SecurityProviderProps {
  children: React.ReactNode;
}

export function SecurityProvider({ children }: SecurityProviderProps) {
  const { user, session } = useAuth();

  useEffect(() => {
    // Apply security headers to all requests
    const originalFetch = window.fetch;
    window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
      const headers = applySecurityHeaders(init?.headers);
      return originalFetch(input, { ...init, headers });
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    if (user && session) {
      // Log successful authentication
      SecurityMonitor.getInstance().logSecurityEvent({
        type: SECURITY_EVENT_TYPES.LOGIN_SUCCESS,
        severity: 'low',
        userId: user.id,
        details: {
          loginTime: new Date().toISOString(),
          userAgent: navigator.userAgent
        }
      });
    }
  }, [user, session]);

  return <>{children}</>;
}