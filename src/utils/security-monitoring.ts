import { SECURITY_EVENT_TYPES, SecurityEventType, SecuritySeverity, RateLimiter } from './security-headers';
import { supabase } from '@/integrations/supabase/client';

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecuritySeverity;
  userId?: string;
  details: Record<string, any>;
  timestamp: number;
  userAgent?: string;
  ipAddress?: string;
}

export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private events: SecurityEvent[] = [];
  private readonly MAX_EVENTS = 1000;
  private rateLimiter = new RateLimiter(10, 5 * 60 * 1000); // 10 attempts per 5 minutes

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  logSecurityEvent(event: Omit<SecurityEvent, 'timestamp' | 'userAgent'>): void {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
    };

    this.events.push(securityEvent);

    // Keep only the last MAX_EVENTS
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }

    // Log to console only in development
    if (import.meta.env.DEV) {
      console.log('Security Event:', securityEvent);
    }

    // Send critical events to monitoring service immediately
    if (event.severity === 'critical') {
      this.sendToMonitoringService(securityEvent);
    }

    // Check for patterns that might indicate an attack
    this.analyzeSecurityPatterns();
  }

  private analyzeSecurityPatterns(): void {
    const recentEvents = this.events.filter(
      event => Date.now() - event.timestamp < 5 * 60 * 1000 // Last 5 minutes
    );

    // Check for rapid authentication failures
    const authFailures = recentEvents.filter(
      event => event.type === SECURITY_EVENT_TYPES.LOGIN_FAILURE && event.details.success === false
    );

    if (authFailures.length > 5) {
      this.logSecurityEvent({
        type: SECURITY_EVENT_TYPES.SUSPICIOUS_ACTIVITY,
        severity: 'high',
        details: {
          pattern: 'rapid_auth_failures',
          count: authFailures.length,
          timeWindow: '5_minutes'
        }
      });
    }

    // Check for unusual data access patterns
    const dataAccessEvents = recentEvents.filter(
      event => event.type === SECURITY_EVENT_TYPES.SENSITIVE_DATA_ACCESS
    );

    const uniqueUsers = new Set(dataAccessEvents.map(event => event.userId));
    if (uniqueUsers.size === 1 && dataAccessEvents.length > 20) {
      this.logSecurityEvent({
        type: SECURITY_EVENT_TYPES.SUSPICIOUS_ACTIVITY,
        severity: 'medium',
        details: {
          pattern: 'excessive_data_access',
          userId: Array.from(uniqueUsers)[0],
          count: dataAccessEvents.length
        }
      });
    }
  }

  private async sendToMonitoringService(event: SecurityEvent): Promise<void> {
    try {
      // Use the enhanced security event logging function
      const { error } = await supabase.rpc('enhanced_log_security_event', {
        _event_type: event.type,
        _severity: event.severity,
        _ip_address: event.ipAddress || null,
        _user_agent: event.userAgent || null,
        _details: event.details || null
      });

      if (error) {
        console.error('Failed to log security event to database:', error);
      }
    } catch (error) {
      console.error('Failed to send security event to monitoring service:', error);
    }
  }

  // Enhanced method to check rate limiting
  checkRateLimit(identifier: string): boolean {
    return this.rateLimiter.isRateLimited(identifier);
  }

  // Reset rate limit for identifier
  resetRateLimit(identifier: string): void {
    this.rateLimiter.reset(identifier);
  }

  getRecentEvents(timeWindowMs: number = 60 * 60 * 1000): SecurityEvent[] {
    const cutoff = Date.now() - timeWindowMs;
    return this.events.filter(event => event.timestamp > cutoff);
  }

  getEventsByType(type: SecurityEvent['type']): SecurityEvent[] {
    return this.events.filter(event => event.type === type);
  }

  getEventsBySeverity(severity: SecurityEvent['severity']): SecurityEvent[] {
    return this.events.filter(event => event.severity === severity);
  }

  // Method to detect potential brute force attacks
  detectBruteForceAttempt(userId?: string): boolean {
    const timeWindow = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 10;

    const recentAuthFailures = this.events.filter(event => 
      event.type === SECURITY_EVENT_TYPES.LOGIN_FAILURE &&
      event.details.success === false &&
      Date.now() - event.timestamp < timeWindow &&
      (!userId || event.userId === userId)
    );

    return recentAuthFailures.length >= maxAttempts;
  }

  // Method to detect unusual access patterns
  detectUnusualAccess(userId: string): boolean {
    const timeWindow = 60 * 60 * 1000; // 1 hour
    const recentAccess = this.events.filter(event =>
      event.userId === userId &&
      Date.now() - event.timestamp < timeWindow
    );

    // Check for access from multiple IPs (simplified)
    const uniqueIPs = new Set(recentAccess.map(event => event.ipAddress));
    if (uniqueIPs.size > 3) {
      return true;
    }

    // Check for excessive API calls
    if (recentAccess.length > 100) {
      return true;
    }

    return false;
  }

  // Clear old events (should be called periodically)
  cleanupOldEvents(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    this.events = this.events.filter(event => event.timestamp > cutoff);
  }
}

// Enhanced helper functions using new security event types
export const logAuthEvent = (success: boolean, userId?: string, details?: Record<string, any>) => {
  const monitor = SecurityMonitor.getInstance();
  monitor.logSecurityEvent({
    type: success ? SECURITY_EVENT_TYPES.LOGIN_SUCCESS : SECURITY_EVENT_TYPES.LOGIN_FAILURE,
    severity: success ? 'low' : 'medium',
    userId,
    details: {
      success,
      ...details
    }
  });
};

// Helper function to log data access events
export const logDataAccessEvent = (userId: string, resource: string, action: string) => {
  const monitor = SecurityMonitor.getInstance();
  monitor.logSecurityEvent({
    type: SECURITY_EVENT_TYPES.SENSITIVE_DATA_ACCESS,
    severity: 'low',
    userId,
    details: {
      resource,
      action
    }
  });
};

// Helper function to log unauthorized access attempts
export const logUnauthorizedAccess = (userId?: string, resource?: string, details?: Record<string, any>) => {
  const monitor = SecurityMonitor.getInstance();
  monitor.logSecurityEvent({
    type: SECURITY_EVENT_TYPES.UNAUTHORIZED_ACCESS,
    severity: 'medium',
    userId,
    details: {
      resource,
      ...details
    }
  });
};

// Helper function to log rate limit violations
export const logRateLimitExceeded = (identifier: string, details?: Record<string, any>) => {
  const monitor = SecurityMonitor.getInstance();
  monitor.logSecurityEvent({
    type: SECURITY_EVENT_TYPES.RATE_LIMIT_EXCEEDED,
    severity: 'medium',
    details: {
      identifier,
      ...details
    }
  });
};

// Helper function to log file upload events  
export const logFileUploadEvent = (userId: string, fileName: string, fileSize: number, success: boolean) => {
  const monitor = SecurityMonitor.getInstance();
  monitor.logSecurityEvent({
    type: success ? SECURITY_EVENT_TYPES.SENSITIVE_DATA_ACCESS : SECURITY_EVENT_TYPES.MALFORMED_REQUEST,
    severity: success ? 'low' : 'medium',
    userId,
    details: {
      fileName,
      fileSize,
      success,
      action: 'file_upload'
    }
  });
};
