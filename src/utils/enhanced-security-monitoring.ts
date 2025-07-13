
import { SecurityMonitor, SecurityEvent } from "./security-monitoring";

interface BruteForceAttempt {
  identifier: string;
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  blocked: boolean;
}

interface SuspiciousActivity {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  userId?: string;
  data: any;
}

export class EnhancedSecurityMonitor extends SecurityMonitor {
  private bruteForceAttempts = new Map<string, BruteForceAttempt>();
  private blockedIPs = new Set<string>();
  private readonly MAX_ATTEMPTS = 5;
  private readonly BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes

  detectBruteForceAttack(identifier: string, eventType: string): boolean {
    const now = Date.now();
    const attempt = this.bruteForceAttempts.get(identifier);

    if (!attempt) {
      this.bruteForceAttempts.set(identifier, {
        identifier,
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now,
        blocked: false
      });
      return false;
    }

    // Reset if enough time has passed
    if (now - attempt.lastAttempt > this.BLOCK_DURATION) {
      this.bruteForceAttempts.set(identifier, {
        identifier,
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now,
        blocked: false
      });
      return false;
    }

    attempt.attempts++;
    attempt.lastAttempt = now;

    if (attempt.attempts >= this.MAX_ATTEMPTS && !attempt.blocked) {
      attempt.blocked = true;
      this.blockedIPs.add(identifier);
      
      this.logSecurityEvent({
        type: 'suspicious_activity',
        severity: 'critical',
        details: {
          pattern: 'brute_force_detected',
          identifier,
          attempts: attempt.attempts,
          timeWindow: now - attempt.firstAttempt,
          eventType,
          blocked: true
        }
      });

      // Auto-unblock after duration
      setTimeout(() => {
        this.blockedIPs.delete(identifier);
        this.bruteForceAttempts.delete(identifier);
      }, this.BLOCK_DURATION);

      return true;
    }

    return attempt.blocked;
  }

  isBlocked(identifier: string): boolean {
    return this.blockedIPs.has(identifier);
  }

  analyzeUserBehavior(userId: string): SuspiciousActivity[] {
    const suspicious: SuspiciousActivity[] = [];
    const userEvents = this.getRecentEvents(60 * 60 * 1000) // Last hour
      .filter(event => event.userId === userId);

    // Check for rapid successive logins
    const loginEvents = userEvents.filter(event => 
      event.type === 'authentication' && event.details.success
    );
    
    if (loginEvents.length > 10) {
      suspicious.push({
        type: 'rapid_logins',
        severity: 'warning',
        description: `User performed ${loginEvents.length} logins in the last hour`,
        userId,
        data: { count: loginEvents.length }
      });
    }

    // Check for data access patterns
    const dataAccessEvents = userEvents.filter(event => event.type === 'data_access');
    if (dataAccessEvents.length > 100) {
      suspicious.push({
        type: 'excessive_data_access',
        severity: 'critical',
        description: `User accessed data ${dataAccessEvents.length} times in the last hour`,
        userId,
        data: { count: dataAccessEvents.length }
      });
    }

    // Check for failed authorization attempts
    const authFailures = userEvents.filter(event => 
      event.type === 'authorization' && 
      event.details.success === false
    );
    
    if (authFailures.length > 5) {
      suspicious.push({
        type: 'authorization_failures',
        severity: 'critical',
        description: `User had ${authFailures.length} authorization failures in the last hour`,
        userId,
        data: { count: authFailures.length }
      });
    }

    return suspicious;
  }

  generateSecurityReport(): {
    summary: any;
    recentEvents: SecurityEvent[];
    suspiciousActivities: SuspiciousActivity[];
    blockedIPs: string[];
  } {
    const recentEvents = this.getRecentEvents(24 * 60 * 60 * 1000); // Last 24 hours
    
    const eventCounts = recentEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const severityCounts = recentEvents.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Analyze all users for suspicious behavior
    const uniqueUsers = [...new Set(recentEvents.map(e => e.userId).filter(Boolean))];
    const suspiciousActivities = uniqueUsers.flatMap(userId => 
      this.analyzeUserBehavior(userId as string)
    );

    return {
      summary: {
        totalEvents: recentEvents.length,
        eventTypes: eventCounts,
        severityBreakdown: severityCounts,
        suspiciousActivitiesCount: suspiciousActivities.length,
        blockedIPsCount: this.blockedIPs.size
      },
      recentEvents: recentEvents.slice(-50), // Last 50 events
      suspiciousActivities,
      blockedIPs: Array.from(this.blockedIPs)
    };
  }
}

// Export singleton instance
export const enhancedSecurityMonitor = new EnhancedSecurityMonitor();

// Helper functions for logging specific security events
export const logPasswordVerificationAttempt = (success: boolean, identifier: string, details?: any) => {
  enhancedSecurityMonitor.logSecurityEvent({
    type: 'authentication',
    severity: success ? 'info' : 'warning',
    details: {
      action: 'password_verification',
      success,
      identifier,
      ...details
    }
  });

  if (!success) {
    enhancedSecurityMonitor.detectBruteForceAttack(identifier, 'password_verification');
  }
};

export const logFileUploadAttempt = (success: boolean, userId: string, fileName: string, fileSize: number) => {
  enhancedSecurityMonitor.logSecurityEvent({
    type: 'file_upload',
    severity: success ? 'info' : 'warning',
    userId,
    details: {
      success,
      fileName,
      fileSize,
      timestamp: Date.now()
    }
  });
};

export const logDataAccessAttempt = (userId: string, resource: string, action: string, success: boolean = true) => {
  enhancedSecurityMonitor.logSecurityEvent({
    type: 'data_access',
    severity: 'info',
    userId,
    details: {
      resource,
      action,
      success,
      timestamp: Date.now()
    }
  });
};
