/**
 * Enhanced security validation utilities
 * Provides standardized validation and sanitization across the application
 */

export interface ValidationResult {
  isValid: boolean;
  sanitized?: string;
  errors: string[];
}

export class SecurityValidation {
  // Rate limiting storage
  private static rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  /**
   * Comprehensive input sanitization
   */
  static sanitizeInput(input: string, maxLength: number = 1000): string {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .trim()
      .slice(0, maxLength)
      // Remove potentially dangerous HTML/script content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      // Escape HTML entities
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Validate and sanitize text content
   */
  static validateTextContent(content: string, maxLength: number = 10000): ValidationResult {
    const errors: string[] = [];
    
    if (!content || typeof content !== 'string') {
      errors.push('Content is required and must be a string');
      return { isValid: false, errors };
    }

    if (content.length > maxLength) {
      errors.push(`Content must not exceed ${maxLength} characters`);
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:text\/html/i,
      /vbscript:/i
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(content))) {
      errors.push('Content contains potentially dangerous script elements');
    }

    const sanitized = this.sanitizeInput(content, maxLength);
    
    return {
      isValid: errors.length === 0,
      sanitized,
      errors
    };
  }

  /**
   * Enhanced email validation
   */
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];
    
    if (!email || typeof email !== 'string') {
      errors.push('Email is required');
      return { isValid: false, errors };
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (email.length > 254) {
      errors.push('Email address is too long');
    }

    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    }

    // Check for suspicious email patterns
    if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) {
      errors.push('Email contains invalid character sequences');
    }

    const sanitized = email.toLowerCase().trim();

    return {
      isValid: errors.length === 0,
      sanitized,
      errors
    };
  }

  /**
   * Enhanced password validation
   */
  static validatePassword(password: string): ValidationResult {
    const errors: string[] = [];
    
    if (!password || typeof password !== 'string') {
      errors.push('Password is required');
      return { isValid: false, errors };
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common weak patterns
    const weakPatterns = [
      /^(.)\1{7,}$/, // Repeated characters
      /^(012|123|234|345|456|567|678|789|890|987|876|765|654|543|432|321|210)/, // Sequential
      /^(password|qwerty|abc|123)/i, // Common weak passwords
    ];

    if (weakPatterns.some(pattern => pattern.test(password))) {
      errors.push('Password contains weak patterns');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Rate limiting check
   */
  static checkRateLimit(
    identifier: string, 
    maxAttempts: number = 10, 
    windowMs: number = 60000
  ): boolean {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);
    
    if (!record || now > record.resetTime) {
      this.rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (record.count >= maxAttempts) {
      return false;
    }
    
    record.count++;
    return true;
  }

  /**
   * Validate file uploads
   */
  static validateFile(
    file: File, 
    allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSize: number = 10 * 1024 * 1024 // 10MB
  ): ValidationResult {
    const errors: string[] = [];
    
    if (!file) {
      errors.push('File is required');
      return { isValid: false, errors };
    }

    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    if (file.size > maxSize) {
      errors.push(`File size ${file.size} exceeds maximum allowed size of ${maxSize} bytes`);
    }

    // Check for suspicious file patterns
    const suspiciousExtensions = /\.(exe|bat|cmd|scr|pif|vbs|js|jar|com|pif)$/i;
    if (suspiciousExtensions.test(file.name)) {
      errors.push('File type appears to be executable and is not allowed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate UUID format
   */
  static validateUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate URL format
   */
  static validateURL(url: string): ValidationResult {
    const errors: string[] = [];
    
    if (!url || typeof url !== 'string') {
      errors.push('URL is required');
      return { isValid: false, errors };
    }

    try {
      const urlObj = new URL(url);
      
      // Only allow HTTP and HTTPS protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        errors.push('Only HTTP and HTTPS URLs are allowed');
      }

      // Check for suspicious URL patterns
      if (url.includes('javascript:') || url.includes('data:') || url.includes('vbscript:')) {
        errors.push('URL contains potentially dangerous protocol');
      }

    } catch {
      errors.push('Invalid URL format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate secure token
   */
  static generateSecureToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    for (let i = 0; i < length; i++) {
      token += chars[array[i] % chars.length];
    }
    
    return token;
  }

  /**
   * Clean up rate limiting storage (call periodically)
   */
  static cleanupRateLimit(): void {
    const now = Date.now();
    for (const [key, record] of this.rateLimitMap.entries()) {
      if (now > record.resetTime) {
        this.rateLimitMap.delete(key);
      }
    }
  }
}

export default SecurityValidation;