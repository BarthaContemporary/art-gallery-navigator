
export class SecurityUtils {
  // Constant time comparison to prevent timing attacks
  static constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    return result === 0;
  }

  // Enhanced sanitize text output to prevent XSS
  static sanitizeText(text: string): string {
    if (!text || typeof text !== 'string') return '';
    
    // Enhanced sanitization with comprehensive protection
    return text
      .replace(/&/g, '&amp;')
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
      // Remove control characters
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/\x00/g, '')
      .trim();
  }
}
