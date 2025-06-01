
import { toast } from 'sonner';

export class EnhancedInputValidator {
  private static readonly EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  private static readonly PHONE_REGEX = /^[\+]?[1-9][\d]{0,15}$/;
  private static readonly URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
  
  // Rate limiting storage
  private static attempts: Map<string, number[]> = new Map();

  static validateEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    return this.EMAIL_REGEX.test(email.trim());
  }

  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!password || typeof password !== 'string') {
      errors.push('Password is required');
      return { isValid: false, errors };
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common weak passwords
    const commonPasswords = ['password', '123456', 'qwerty', 'abc123', 'password123'];
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common. Please choose a stronger password');
    }

    return { isValid: errors.length === 0, errors };
  }

  static validatePhone(phone: string): boolean {
    if (!phone || typeof phone !== 'string') return false;
    return this.PHONE_REGEX.test(phone.trim());
  }

  static validateUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    return this.URL_REGEX.test(url.trim());
  }

  static sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[<>'"&]/g, (char) => {
        const entityMap: Record<string, string> = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return entityMap[char] || char;
      })
      .slice(0, 1000); // Limit input length
  }

  static sanitizeHtml(html: string): string {
    if (!html || typeof html !== 'string') return '';
    
    // Allow only safe HTML tags
    const allowedTags = ['b', 'i', 'em', 'strong', 'p', 'br'];
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>/gi;
    
    return html.replace(tagRegex, (match, tagName) => {
      if (allowedTags.includes(tagName.toLowerCase())) {
        return match;
      }
      return '';
    });
  }

  static validateFile(
    file: File, 
    allowedTypes: string[] = [], 
    maxSize: number = 10 * 1024 * 1024
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors };
    }

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size must be less than ${Math.round(maxSize / (1024 * 1024))}MB`);
    }

    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Check file name for suspicious content
    if (/[<>:"/\\|?*]/.test(file.name)) {
      errors.push('File name contains invalid characters');
    }

    if (file.name.length > 255) {
      errors.push('File name is too long');
    }

    return { isValid: errors.length === 0, errors };
  }

  static checkRateLimit(action: string, maxAttempts: number, windowMs: number): boolean {
    const key = `${action}_${this.getClientId()}`;
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts outside the window
    const recentAttempts = attempts.filter(time => now - time < windowMs);
    
    if (recentAttempts.length >= maxAttempts) {
      return false;
    }
    
    // Add current attempt
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    
    return true;
  }

  private static getClientId(): string {
    // Create a simple client identifier based on browser characteristics
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Browser fingerprint', 2, 2);
    }
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString();
  }

  static validateTextLength(text: string, minLength: number = 0, maxLength: number = 1000): boolean {
    if (!text || typeof text !== 'string') return minLength === 0;
    return text.length >= minLength && text.length <= maxLength;
  }

  static validateNumeric(value: string, min?: number, max?: number): boolean {
    if (!value || typeof value !== 'string') return false;
    
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    
    if (min !== undefined && num < min) return false;
    if (max !== undefined && num > max) return false;
    
    return true;
  }

  static validateDate(dateString: string): boolean {
    if (!dateString || typeof dateString !== 'string') return false;
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static validateCSRF(token: string, expectedToken: string): boolean {
    if (!token || !expectedToken) return false;
    
    // Constant-time comparison to prevent timing attacks
    if (token.length !== expectedToken.length) return false;
    
    let result = 0;
    for (let i = 0; i < token.length; i++) {
      result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
    }
    
    return result === 0;
  }

  // XSS prevention for dynamic content
  static createSafeHTML(content: string): string {
    const div = document.createElement('div');
    div.textContent = content;
    return div.innerHTML;
  }

  // Validate and sanitize JSON input
  static validateJSON(jsonString: string): { isValid: boolean; data?: any; error?: string } {
    try {
      if (!jsonString || typeof jsonString !== 'string') {
        return { isValid: false, error: 'Invalid JSON string' };
      }

      if (jsonString.length > 100000) {
        return { isValid: false, error: 'JSON too large' };
      }

      const data = JSON.parse(jsonString);
      return { isValid: true, data };
    } catch (error) {
      return { isValid: false, error: 'Invalid JSON format' };
    }
  }
}
