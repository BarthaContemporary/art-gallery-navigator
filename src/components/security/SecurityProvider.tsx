import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { SecurityMonitor } from '@/utils/security-monitoring';
import { applyEnhancedSecurityHeaders } from '@/lib/security/security-headers';
import { SECURITY_EVENT_TYPES } from '@/utils/security-headers';
import { EnhancedSecurity } from '@/utils/enhanced-security';
import { securityValidator } from '@/lib/security/security-validator';
import { securityDashboard } from '@/lib/security/security-dashboard';

interface SecurityProviderProps {
  children: React.ReactNode;
}

export function SecurityProvider({ children }: SecurityProviderProps) {
  const { user, session } = useAuth();

  useEffect(() => {
    // Apply enhanced security headers to all requests
    const originalFetch = window.fetch;
    window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
      const headers = applyEnhancedSecurityHeaders(init?.headers);
      return originalFetch(input, { ...init, headers });
    };

    // Validate security configuration on mount
    const validateSecurity = async () => {
      try {
        const validation = await securityValidator.validateSystemSecurity();
        const dashboard = await securityDashboard.generateDashboard();
        
        SecurityMonitor.getInstance().logSecurityEvent({
          type: 'security_validation_completed',
          severity: validation.isValid ? 'low' : 'medium',
          details: {
            isValid: validation.isValid,
            securityLevel: validation.securityLevel,
            dashboardScore: dashboard.overallScore
          }
        });
      } catch (error) {
        console.error('Security validation failed:', error);
      }
    };

    validateSecurity();

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

      // Enhanced security monitoring for authenticated users
      EnhancedSecurity.getInstance().logAuthEvent('login_success', user.id, {
        accessToken: session.access_token ? 'present' : 'missing',
        loginTime: new Date().toISOString()
      });
    }
  }, [user, session]);

  useEffect(() => {
    // Monitor for suspicious activity patterns
    if (user) {
      const checkSuspiciousActivity = () => {
        const isSuspicious = EnhancedSecurity.getInstance().checkSuspiciousActivity(user.id);
        if (isSuspicious) {
          SecurityMonitor.getInstance().logSecurityEvent({
            type: SECURITY_EVENT_TYPES.SUSPICIOUS_ACTIVITY,
            severity: 'high',
            userId: user.id,
            details: {
              timestamp: new Date().toISOString(),
              userAgent: navigator.userAgent,
              location: window.location.href
            }
          });
        }
      };

      // Check for suspicious activity every 5 minutes
      const suspiciousActivityInterval = setInterval(checkSuspiciousActivity, 5 * 60 * 1000);
      
      return () => clearInterval(suspiciousActivityInterval);
    }
  }, [user]);

  return <>{children}</>;
}