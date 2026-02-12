import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { SecurityMonitor } from '@/utils/security-monitoring';
import { SECURITY_EVENT_TYPES } from '@/utils/security-headers';
import { EnhancedSecurity } from '@/utils/enhanced-security';

interface SecurityProviderProps {
  children: React.ReactNode;
}

export function SecurityProvider({ children }: SecurityProviderProps) {
  const { user, session } = useAuth();

  useEffect(() => {
    // Defer heavy security validation to after app is interactive
    const timerId = setTimeout(async () => {
      try {
        const { securityValidator } = await import('@/lib/security/security-validator');
        const { securityDashboard } = await import('@/lib/security/security-dashboard');
        
        const validation = await securityValidator.validateSystemSecurity();
        const dashboard = await securityDashboard.generateDashboard();
        
        SecurityMonitor.getInstance().logSecurityEvent({
          type: SECURITY_EVENT_TYPES.ADMIN_FUNCTION_USED,
          severity: validation.isValid ? 'low' : 'medium',
          details: {
            action: 'security_validation_completed',
            isValid: validation.isValid,
            securityLevel: validation.securityLevel,
            dashboardScore: dashboard.overallScore
          }
        });
      } catch (error) {
        console.error('Security validation failed:', error);
      }
    }, 5000);

    return () => clearTimeout(timerId);
  }, []);

  useEffect(() => {
    if (user && session) {
      SecurityMonitor.getInstance().logSecurityEvent({
        type: SECURITY_EVENT_TYPES.LOGIN_SUCCESS,
        severity: 'low',
        userId: user.id,
        details: {
          loginTime: new Date().toISOString(),
          userAgent: navigator.userAgent
        }
      });

      EnhancedSecurity.getInstance().logAuthEvent('login_success', user.id, {
        accessToken: session.access_token ? 'present' : 'missing',
        loginTime: new Date().toISOString()
      });
    }
  }, [user, session]);

  useEffect(() => {
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

      const suspiciousActivityInterval = setInterval(checkSuspiciousActivity, 5 * 60 * 1000);
      
      return () => clearInterval(suspiciousActivityInterval);
    }
  }, [user]);

  return <>{children}</>;
}
