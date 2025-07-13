import { supabase } from "@/integrations/supabase/client";
import { SecurityMonitor } from "./security-monitoring";
import { SECURITY_EVENT_TYPES } from "./security-headers";

/**
 * Enhanced security utilities with comprehensive logging and monitoring
 */
export class EnhancedSecurity {
  private static instance: EnhancedSecurity;
  private securityMonitor: SecurityMonitor;

  private constructor() {
    this.securityMonitor = SecurityMonitor.getInstance();
  }

  static getInstance(): EnhancedSecurity {
    if (!EnhancedSecurity.instance) {
      EnhancedSecurity.instance = new EnhancedSecurity();
    }
    return EnhancedSecurity.instance;
  }

  /**
   * Secure data access with comprehensive logging
   */
  async secureDataAccess<T>(
    operation: () => Promise<T>,
    resourceType: string,
    resourceId?: string,
    userId?: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      // Log data access attempt
      this.securityMonitor.logSecurityEvent({
        type: SECURITY_EVENT_TYPES.DATA_ACCESS,
        severity: 'low',
        userId,
        details: {
          resourceType,
          resourceId,
          timestamp: new Date().toISOString(),
          operation: 'access_attempt'
        }
      });

      const result = await operation();
      
      // Log successful access
      this.securityMonitor.logSecurityEvent({
        type: SECURITY_EVENT_TYPES.DATA_ACCESS,
        severity: 'low',
        userId,
        details: {
          resourceType,
          resourceId,
          duration: Date.now() - startTime,
          operation: 'access_success'
        }
      });

      return result;
    } catch (error) {
      // Log failed access
      this.securityMonitor.logSecurityEvent({
        type: SECURITY_EVENT_TYPES.DATA_ACCESS,
        severity: 'medium',
        userId,
        details: {
          resourceType,
          resourceId,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
          operation: 'access_failure'
        }
      });
      
      throw error;
    }
  }

  /**
   * Secure user role checking with caching
   */
  private roleCache = new Map<string, { roles: string[], timestamp: number }>();
  private CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async getUserRoles(userId: string): Promise<string[]> {
    // Check cache first
    const cached = this.roleCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.roles;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) throw error;

      const roles = data?.map(r => r.role) || [];
      
      // Cache the result
      this.roleCache.set(userId, {
        roles,
        timestamp: Date.now()
      });

      return roles;
    } catch (error) {
      this.securityMonitor.logSecurityEvent({
        type: SECURITY_EVENT_TYPES.AUTHORIZATION,
        severity: 'medium',
        userId,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          operation: 'role_check_failure'
        }
      });
      
      return [];
    }
  }

  /**
   * Clear role cache for a user (call when roles change)
   */
  clearRoleCache(userId: string): void {
    this.roleCache.delete(userId);
  }

  /**
   * Enhanced authentication event logging
   */
  async logAuthEvent(
    eventType: 'login_attempt' | 'login_success' | 'login_failure' | 'logout',
    userId?: string,
    details?: Record<string, any>
  ): Promise<void> {
    const severity = eventType.includes('failure') ? 'medium' : 'low';
    
    // Map event types to our security event types
    const securityEventType = eventType === 'login_success' ? SECURITY_EVENT_TYPES.LOGIN_SUCCESS :
                              eventType === 'login_failure' ? SECURITY_EVENT_TYPES.LOGIN_FAILURE :
                              eventType === 'logout' ? SECURITY_EVENT_TYPES.LOGOUT :
                              SECURITY_EVENT_TYPES.AUTHENTICATION;
    
    this.securityMonitor.logSecurityEvent({
      type: securityEventType,
      severity,
      userId,
      details: {
        ...details,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      }
    });

    // Also log to Supabase for persistent storage
    try {
      await supabase.rpc('enhanced_log_security_event', {
        _event_type: eventType,
        _severity: severity,
        _details: details ? JSON.stringify(details) : null
      });
    } catch (error) {
      console.error('Failed to log security event to database:', error);
    }
  }

  /**
   * Monitor for suspicious activity patterns
   */
  checkSuspiciousActivity(userId: string): boolean {
    return this.securityMonitor.detectBruteForceAttempt(userId) ||
           this.securityMonitor.detectUnusualAccess(userId);
  }
}