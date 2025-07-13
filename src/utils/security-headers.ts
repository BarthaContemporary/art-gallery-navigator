// Security headers utility for enhanced web application security
export const SECURITY_HEADERS = {
  // Content Security Policy - Prevents XSS attacks
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com", // Cloudflare Turnstile
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: http:", // Allow images from various sources including Supabase storage
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
    "frame-src 'self' https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '),
  
  // Prevent clickjacking attacks
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Enable XSS protection in browsers
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer policy for privacy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions policy to restrict dangerous features
  'Permissions-Policy': [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()'
  ].join(', ')
} as const;

// Apply security headers to responses
export function applySecurityHeaders(headers?: HeadersInit): HeadersInit {
  return {
    ...SECURITY_HEADERS,
    ...headers
  };
}

// Rate limiting utilities
export class RateLimiter {
  private attempts = new Map<string, { count: number; lastAttempt: number }>();
  
  constructor(
    private maxAttempts: number = 5,
    private windowMs: number = 15 * 60 * 1000 // 15 minutes
  ) {}
  
  isRateLimited(identifier: string): boolean {
    const now = Date.now();
    const record = this.attempts.get(identifier);
    
    if (!record) {
      this.attempts.set(identifier, { count: 1, lastAttempt: now });
      return false;
    }
    
    // Reset if window has passed
    if (now - record.lastAttempt > this.windowMs) {
      this.attempts.set(identifier, { count: 1, lastAttempt: now });
      return false;
    }
    
    // Increment attempt count
    record.count++;
    record.lastAttempt = now;
    
    return record.count > this.maxAttempts;
  }
  
  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }
  
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.attempts.entries()) {
      if (now - record.lastAttempt > this.windowMs) {
        this.attempts.delete(key);
      }
    }
  }
}

// Enhanced security event types
export const SECURITY_EVENT_TYPES = {
  // Authentication events
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  LOGOUT: 'logout',
  PASSWORD_RESET: 'password_reset',
  AUTHENTICATION: 'authentication',
  
  // Authorization events
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  PERMISSION_DENIED: 'permission_denied',
  ROLE_ESCALATION_ATTEMPT: 'role_escalation_attempt',
  AUTHORIZATION: 'authorization',
  
  // Data access events
  SENSITIVE_DATA_ACCESS: 'sensitive_data_access',
  BULK_DATA_EXPORT: 'bulk_data_export',
  ADMIN_FUNCTION_USED: 'admin_function_used',
  DATA_ACCESS: 'data_access',
  
  // File operations
  FILE_UPLOAD: 'file_upload',
  
  // Security violations
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  MALFORMED_REQUEST: 'malformed_request'
} as const;

export type SecurityEventType = typeof SECURITY_EVENT_TYPES[keyof typeof SECURITY_EVENT_TYPES];
export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';