/**
 * Advanced Input Sanitization Utility
 * Provides comprehensive protection against various injection attacks
 */

export interface SanitizationConfig {
  maxLength?: number;
  allowHTML?: boolean;
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  strictMode?: boolean;
  preserveWhitespace?: boolean;
}

export interface SanitizationResult {
  sanitized: string;
  original: string;
  warnings: string[];
  blocked: string[];
  safe: boolean;
}

export class AdvancedInputSanitizer {
  // Comprehensive dangerous patterns for different attack vectors
  private static readonly DANGEROUS_PATTERNS = {
    // XSS patterns
    xss: [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
      /<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi,
      /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
      /<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi,
      /<meta\b[^<]*(?:(?!<\/meta>)<[^<]*)*<\/meta>/gi,
      /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
      /on\w+\s*=\s*['""][^'"]*['"]/gi,
      /javascript\s*:/gi,
      /vbscript\s*:/gi,
      /data\s*:\s*text\/html/gi,
      /expression\s*\(/gi,
    ],
    
    // SQL injection patterns
    sql: [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
      /(\b(OR|AND)\s+['"]\w+['"]\s*=\s*['"]\w+['"])/gi,
      /(--|\/\*|\*\/)/g,
      /(\bINTO\s+OUTFILE\b)/gi,
      /(\bLOAD_FILE\s*\()/gi,
      /(\bUNION\s+SELECT)/gi,
    ],
    
    // Command injection patterns
    command: [
      /(\b(curl|wget|nc|netcat|telnet|ssh|ftp|ping|nslookup|dig)\b)/gi,
      /(&&|\|\||;|`|\$\(|\${)/g,
      /(\b(cat|ls|ps|whoami|id|uname|pwd)\b)/gi,
      /(>|>>|<|2>&1)/g,
    ],
    
    // Path traversal patterns
    path: [
      /(\.{2,}[\/\\])/g,
      /(^[\/\\]|\.\.[\/\\])/g,
      /(%2e%2e%2f|%2e%2e%5c|\.\.\/|\.\.\\)/gi,
      /(\/etc\/passwd|\/etc\/shadow|\/etc\/hosts)/gi,
    ],
    
    // LDAP injection patterns
    ldap: [
      /(\*|\(|\)|\||&|!|=|<|>|~|\/)/g,
      /(objectClass=|cn=|ou=|dc=)/gi,
    ],
    
    // XML injection patterns
    xml: [
      /(<!\[CDATA\[.*?\]\]>)/gi,
      /(<!DOCTYPE[^>]*>)/gi,
      /(<!ENTITY[^>]*>)/gi,
      /(&\w+;)/g,
    ],
  };

  // Dangerous protocols and schemes
  private static readonly DANGEROUS_PROTOCOLS = [
    'javascript:', 'vbscript:', 'data:', 'file:', 'ftp:', 'mailto:',
    'news:', 'gopher:', 'ldap:', 'dict:', 'telnet:', 'ssh:', 'irc:'
  ];

  // Control characters and dangerous Unicode
  private static readonly CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\uFEFF\u2028\u2029]/g;

  /**
   * Main sanitization method with comprehensive protection
   */
  static sanitize(input: string, config: SanitizationConfig = {}): SanitizationResult {
    const {
      maxLength = 10000,
      allowHTML = false,
      allowedTags = [],
      allowedAttributes = {},
      strictMode = true,
      preserveWhitespace = false
    } = config;

    const warnings: string[] = [];
    const blocked: string[] = [];
    const original = input;

    if (!input || typeof input !== 'string') {
      return {
        sanitized: '',
        original,
        warnings: ['Invalid input type'],
        blocked: [],
        safe: false
      };
    }

    let sanitized = input;

    // Length validation
    if (sanitized.length > maxLength) {
      sanitized = sanitized.slice(0, maxLength);
      warnings.push(`Input truncated to ${maxLength} characters`);
    }

    // Remove control characters first
    const controlMatches = sanitized.match(this.CONTROL_CHARS);
    if (controlMatches) {
      blocked.push(...controlMatches);
      sanitized = sanitized.replace(this.CONTROL_CHARS, '');
    }

    // Check for dangerous patterns based on attack type
    sanitized = this.detectAndBlockPatterns(sanitized, warnings, blocked);

    // Protocol sanitization
    sanitized = this.sanitizeProtocols(sanitized, warnings, blocked);

    // HTML sanitization
    if (allowHTML && allowedTags.length > 0) {
      sanitized = this.sanitizeHTML(sanitized, allowedTags, allowedAttributes, warnings, blocked);
    } else if (strictMode) {
      sanitized = this.escapeHTML(sanitized);
    }

    // Whitespace normalization
    if (!preserveWhitespace) {
      sanitized = sanitized.replace(/\s+/g, ' ').trim();
    }

    // Final encoding for safety
    sanitized = this.finalEncoding(sanitized);

    const safe = warnings.length === 0 && blocked.length === 0;

    return {
      sanitized,
      original,
      warnings,
      blocked,
      safe
    };
  }

  /**
   * Detect and block dangerous patterns
   */
  private static detectAndBlockPatterns(input: string, warnings: string[], blocked: string[]): string {
    let sanitized = input;

    // Check each category of dangerous patterns
    Object.entries(this.DANGEROUS_PATTERNS).forEach(([category, patterns]) => {
      patterns.forEach(pattern => {
        const matches = sanitized.match(pattern);
        if (matches) {
          blocked.push(...matches);
          warnings.push(`Blocked ${category} injection attempt`);
          sanitized = sanitized.replace(pattern, '');
        }
      });
    });

    return sanitized;
  }

  /**
   * Sanitize dangerous protocols
   */
  private static sanitizeProtocols(input: string, warnings: string[], blocked: string[]): string {
    let sanitized = input;

    this.DANGEROUS_PROTOCOLS.forEach(protocol => {
      const regex = new RegExp(protocol.replace(':', '\\s*:'), 'gi');
      const matches = sanitized.match(regex);
      if (matches) {
        blocked.push(...matches);
        warnings.push(`Blocked dangerous protocol: ${protocol}`);
        sanitized = sanitized.replace(regex, '');
      }
    });

    return sanitized;
  }

  /**
   * HTML sanitization for allowed content
   */
  private static sanitizeHTML(
    input: string,
    allowedTags: string[],
    allowedAttributes: Record<string, string[]>,
    warnings: string[],
    blocked: string[]
  ): string {
    // Simple regex-based HTML sanitization
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>/gi;
    
    return input.replace(tagRegex, (match, tagName) => {
      if (!allowedTags.includes(tagName.toLowerCase())) {
        blocked.push(match);
        warnings.push(`Removed disallowed tag: ${tagName}`);
        return '';
      }

      // Remove dangerous attributes
      return this.sanitizeAttributes(match, tagName, allowedAttributes[tagName.toLowerCase()] || [], warnings);
    });
  }

  /**
   * Sanitize tag attributes
   */
  private static sanitizeAttributes(tag: string, tagName: string, allowedAttrs: string[], warnings: string[]): string {
    const attrRegex = /\s+([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*["']([^"']*)["']/g;
    
    return tag.replace(attrRegex, (match, attrName, attrValue) => {
      if (!allowedAttrs.includes(attrName.toLowerCase())) {
        warnings.push(`Removed attribute ${attrName} from ${tagName}`);
        return '';
      }

      // Sanitize attribute value
      const sanitizedValue = this.sanitizeAttributeValue(attrValue);
      return ` ${attrName}="${sanitizedValue}"`;
    });
  }

  /**
   * Sanitize attribute values
   */
  private static sanitizeAttributeValue(value: string): string {
    return value
      .replace(/javascript\s*:/gi, '')
      .replace(/vbscript\s*:/gi, '')
      .replace(/data\s*:\s*text\/html/gi, '')
      .replace(/[<>"'`]/g, '');
  }

  /**
   * Escape HTML entities
   */
  private static escapeHTML(input: string): string {
    const entityMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    };

    return input.replace(/[&<>"'`=\/]/g, (char) => entityMap[char]);
  }

  /**
   * Final encoding for additional safety
   */
  private static finalEncoding(input: string): string {
    // Remove any remaining null bytes or problematic characters
    return input
      .replace(/\x00/g, '')
      .replace(/\uFEFF/g, '')
      .replace(/[\u2028\u2029]/g, '');
  }

  /**
   * Quick sanitization for simple text
   */
  static sanitizeText(input: string, maxLength: number = 1000): string {
    const result = this.sanitize(input, { maxLength, strictMode: true, allowHTML: false });
    return result.sanitized;
  }

  /**
   * Sanitize for database insertion
   */
  static sanitizeForDatabase(input: string): string {
    const result = this.sanitize(input, {
      maxLength: 5000,
      strictMode: true,
      allowHTML: false,
      preserveWhitespace: true
    });
    return result.sanitized;
  }

  /**
   * Sanitize URL input
   */
  static sanitizeURL(url: string): string {
    if (!url || typeof url !== 'string') return '';

    try {
      const urlObj = new URL(url);
      
      // Only allow HTTP and HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return '';
      }

      return urlObj.toString();
    } catch {
      return '';
    }
  }

  /**
   * Sanitize filename for upload
   */
  static sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') return '';

    return filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      .replace(/^\.+/, '')
      .replace(/\.+$/, '')
      .slice(0, 255);
  }

  /**
   * Check if input is potentially dangerous
   */
  static isDangerous(input: string): boolean {
    const result = this.sanitize(input, { strictMode: true });
    return !result.safe;
  }
}

export default AdvancedInputSanitizer;