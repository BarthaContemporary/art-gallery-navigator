
import { enhancedSecurityMonitor, logPasswordVerificationAttempt } from "./enhanced-security-monitoring";

interface PasswordAttempt {
  count: number;
  lastAttempt: number;
  blocked: boolean;
}

class CollectionPasswordSecurity {
  private attemptMap = new Map<string, PasswordAttempt>();
  private readonly MAX_ATTEMPTS = 5;
  private readonly BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes
  private readonly ATTEMPT_WINDOW = 5 * 60 * 1000; // 5 minutes

  private getIdentifier(slug: string, ipAddress?: string): string {
    // Use combination of collection slug and IP for rate limiting
    return `${slug}:${ipAddress || 'unknown'}`;
  }

  private isBlocked(identifier: string): boolean {
    const attempt = this.attemptMap.get(identifier);
    if (!attempt) return false;

    const now = Date.now();
    
    // Clear old blocked status
    if (attempt.blocked && (now - attempt.lastAttempt) > this.BLOCK_DURATION) {
      this.attemptMap.delete(identifier);
      return false;
    }

    return attempt.blocked;
  }

  private recordAttempt(identifier: string, success: boolean): void {
    const now = Date.now();
    const attempt = this.attemptMap.get(identifier);

    if (!attempt) {
      this.attemptMap.set(identifier, {
        count: success ? 0 : 1,
        lastAttempt: now,
        blocked: false
      });
      return;
    }

    // Reset count if enough time has passed
    if ((now - attempt.lastAttempt) > this.ATTEMPT_WINDOW) {
      attempt.count = success ? 0 : 1;
      attempt.lastAttempt = now;
      attempt.blocked = false;
      return;
    }

    if (success) {
      // Reset on successful attempt
      attempt.count = 0;
      attempt.blocked = false;
    } else {
      attempt.count++;
      
      if (attempt.count >= this.MAX_ATTEMPTS) {
        attempt.blocked = true;
        
        // Log security event
        enhancedSecurityMonitor.logSecurityEvent({
          type: 'suspicious_activity',
          severity: 'critical',
          details: {
            action: 'collection_password_brute_force',
            identifier,
            attempts: attempt.count,
            blocked: true
          }
        });
      }
    }

    attempt.lastAttempt = now;
  }

  async verifyPassword(
    slug: string, 
    providedPassword: string, 
    hashedPassword: string,
    ipAddress?: string
  ): Promise<{ success: boolean; message?: string; remainingAttempts?: number }> {
    const identifier = this.getIdentifier(slug, ipAddress);

    // Check if blocked
    if (this.isBlocked(identifier)) {
      logPasswordVerificationAttempt(false, identifier, {
        reason: 'rate_limited',
        collection: slug
      });

      return {
        success: false,
        message: 'Too many failed attempts. Please try again later.'
      };
    }

    try {
      // Hash the provided password
      const encoder = new TextEncoder();
      const data = encoder.encode(providedPassword);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const providedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const success = providedHash === hashedPassword;
      
      // Record the attempt
      this.recordAttempt(identifier, success);
      
      // Log the attempt
      logPasswordVerificationAttempt(success, identifier, {
        collection: slug,
        hashedMatched: success
      });

      if (success) {
        return { success: true };
      } else {
        const attempt = this.attemptMap.get(identifier);
        const remainingAttempts = Math.max(0, this.MAX_ATTEMPTS - (attempt?.count || 0));
        
        return {
          success: false,
          message: 'Incorrect password.',
          remainingAttempts
        };
      }
    } catch (error) {
      // Log error
      enhancedSecurityMonitor.logSecurityEvent({
        type: 'authentication',
        severity: 'medium',
        details: {
          action: 'password_verification_error',
          collection: slug,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      return {
        success: false,
        message: 'An error occurred while verifying the password.'
      };
    }
  }

  getRemainingAttempts(slug: string, ipAddress?: string): number {
    const identifier = this.getIdentifier(slug, ipAddress);
    const attempt = this.attemptMap.get(identifier);
    
    if (!attempt) return this.MAX_ATTEMPTS;
    
    return Math.max(0, this.MAX_ATTEMPTS - attempt.count);
  }

  getBlockedTimeRemaining(slug: string, ipAddress?: string): number {
    const identifier = this.getIdentifier(slug, ipAddress);
    const attempt = this.attemptMap.get(identifier);
    
    if (!attempt || !attempt.blocked) return 0;
    
    const now = Date.now();
    const timeRemaining = this.BLOCK_DURATION - (now - attempt.lastAttempt);
    
    return Math.max(0, timeRemaining);
  }
}

export const collectionPasswordSecurity = new CollectionPasswordSecurity();
