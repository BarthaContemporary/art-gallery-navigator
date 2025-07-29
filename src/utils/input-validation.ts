
// Input validation utilities for security
export class InputValidator {
  // Email validation
  static validateEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  // Password strength validation
  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!password || typeof password !== 'string') {
      errors.push('Password is required');
      return { isValid: false, errors };
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (password.length > 128) {
      errors.push('Password must be less than 128 characters');
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

    return { isValid: errors.length === 0, errors };
  }

  // Enhanced sanitize user input to prevent XSS and injection attacks
  static sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    return input
      // First handle ampersands to avoid double encoding
      .replace(/&/g, '&amp;')
      // HTML entity encoding
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/`/g, '&#x60;')
      .replace(/=/g, '&#x3D;')
      // Remove dangerous patterns
      .replace(/javascript\s*:/gi, '')
      .replace(/vbscript\s*:/gi, '')
      .replace(/data\s*:\s*text\/html/gi, '')
      .replace(/on\w+\s*=/gi, '')
      // Remove control characters and null bytes
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/\x00/g, '')
      .replace(/\uFEFF/g, '') // BOM
      .replace(/\u2028/g, '') // Line separator
      .replace(/\u2029/g, '') // Paragraph separator
      // SQL injection prevention
      .replace(/(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|MERGE|SELECT|UPDATE|UNION|SCRIPT)\b)/gi, '')
      // Additional dangerous patterns
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/expression\s*\(/gi, '')
      .replace(/@import/gi, '')
      .trim()
      .slice(0, 10000); // Limit length
  }

  // Validate file uploads
  static validateFile(file: File, allowedTypes: string[], maxSize: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors };
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`);
    }

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size exceeds maximum of ${maxSize / (1024 * 1024)}MB`);
    }

    // Check filename for malicious patterns
    const dangerousPatterns = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.jar'];
    const filename = file.name.toLowerCase();
    if (dangerousPatterns.some(pattern => filename.includes(pattern))) {
      errors.push('File type is potentially dangerous');
    }

    return { isValid: errors.length === 0, errors };
  }

  // Validate and sanitize text content
  static validateTextContent(content: string, maxLength: number = 10000): { isValid: boolean; sanitized: string; errors: string[] } {
    const errors: string[] = [];

    if (!content || typeof content !== 'string') {
      errors.push('Content is required');
      return { isValid: false, sanitized: '', errors };
    }

    if (content.length > maxLength) {
      errors.push(`Content exceeds maximum length of ${maxLength} characters`);
    }

    const sanitized = this.sanitizeInput(content);

    return { isValid: errors.length === 0, sanitized, errors };
  }

  // Rate limiting check (client-side basic implementation)
  static checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now();
    const attempts = JSON.parse(localStorage.getItem(`rate_limit_${key}`) || '[]') as number[];
    
    // Remove old attempts outside the window
    const validAttempts = attempts.filter(timestamp => now - timestamp < windowMs);
    
    if (validAttempts.length >= maxAttempts) {
      return false; // Rate limit exceeded
    }

    // Add current attempt
    validAttempts.push(now);
    localStorage.setItem(`rate_limit_${key}`, JSON.stringify(validAttempts));
    
    return true;
  }

  // Validate UUID format
  static validateUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  // Validate URL format
  static validateURL(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
