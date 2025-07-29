/**
 * Enhanced XSS Sanitization Utility
 * Provides comprehensive protection against XSS attacks
 */

export interface SanitizationOptions {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  maxLength?: number;
  preserveWhitespace?: boolean;
  strictMode?: boolean;
}

export interface SanitizationResult {
  sanitized: string;
  warnings: string[];
  removedElements: string[];
}

export class EnhancedXSSSanitizer {
  // Comprehensive list of dangerous patterns
  private static readonly DANGEROUS_PATTERNS = [
    // Script injections
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi,
    /<meta\b[^<]*(?:(?!<\/meta>)<[^<]*)*<\/meta>/gi,
    /<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi,
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
    
    // Event handlers
    /on\w+\s*=\s*['""][^'"]*['"]/gi,
    /on\w+\s*=\s*[^>\s]+/gi,
    
    // JavaScript protocols
    /javascript\s*:/gi,
    /vbscript\s*:/gi,
    /data\s*:\s*text\/html/gi,
    /data\s*:\s*text\/javascript/gi,
    /data\s*:\s*application\/javascript/gi,
    
    // Expression and import attacks
    /expression\s*\(/gi,
    /@import/gi,
    /binding\s*:/gi,
    /-moz-binding/gi,
    
    // CDATA sections that could contain scripts
    /<!\[CDATA\[.*?\]\]>/gi,
    
    // Comments that could hide scripts
    /<!--[\s\S]*?-->/g,
    
    // SVG script injections
    /<svg\b[^>]*>[\s\S]*?<\/svg>/gi,
  ];

  // Dangerous attributes that should be removed
  private static readonly DANGEROUS_ATTRIBUTES = [
    'onabort', 'onactivate', 'onafterprint', 'onafterscriptexecute', 'onafterupdate',
    'onbeforeactivate', 'onbeforecopy', 'onbeforecut', 'onbeforedeactivate',
    'onbeforeeditfocus', 'onbeforepaste', 'onbeforeprint', 'onbeforescriptexecute',
    'onbeforeunload', 'onbeforeupdate', 'onbegin', 'onblur', 'onbounce', 'oncanplay',
    'oncanplaythrough', 'oncellchange', 'onchange', 'onclick', 'oncontextmenu',
    'oncontrolselect', 'oncopy', 'oncut', 'ondataavailable', 'ondatasetchanged',
    'ondatasetcomplete', 'ondblclick', 'ondeactivate', 'ondrag', 'ondragdrop',
    'ondragend', 'ondragenter', 'ondragleave', 'ondragover', 'ondragstart', 'ondrop',
    'onellipsisclick', 'onend', 'onerror', 'onerrorupdate', 'onfilterchange', 'onfinish',
    'onfocus', 'onfocusin', 'onfocusout', 'onhashchange', 'onhelp', 'oninput',
    'onkeydown', 'onkeypress', 'onkeyup', 'onlayoutcomplete', 'onload', 'onloadstart',
    'onloadend', 'onlosecapture', 'onmediacomplete', 'onmediaerror', 'onmessage',
    'onmousedown', 'onmouseenter', 'onmouseleave', 'onmousemove', 'onmouseout',
    'onmouseover', 'onmouseup', 'onmousewheel', 'onmove', 'onmoveend', 'onmovestart',
    'onoffline', 'ononline', 'onoutofsync', 'onpaste', 'onpause', 'onplay', 'onplaying',
    'onpopstate', 'onprogress', 'onpropertychange', 'onreadystatechange', 'onreset',
    'onresize', 'onresizeend', 'onresizestart', 'onrowenter', 'onrowexit', 'onrowsdelete',
    'onrowsinserted', 'onscroll', 'onsearch', 'onseek', 'onselect', 'onselectionchange',
    'onselectstart', 'onstart', 'onstop', 'onstorage', 'onsubmit', 'onsuspend',
    'ontimeupdate', 'ontoggle', 'onunload', 'onurlflip', 'onvolumechange', 'onwaiting',
    'onwheel', 'style', 'background', 'src', 'href', 'action', 'formaction'
  ];

  // Safe HTML tags (if allowing HTML)
  private static readonly SAFE_TAGS = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'table', 'thead', 'tbody', 'tr', 'td', 'th'
  ];

  // Safe attributes for allowed tags
  private static readonly SAFE_ATTRIBUTES: Record<string, string[]> = {
    'div': ['class', 'id'],
    'span': ['class', 'id'],
    'p': ['class', 'id'],
    'h1': ['class', 'id'],
    'h2': ['class', 'id'],
    'h3': ['class', 'id'],
    'h4': ['class', 'id'],
    'h5': ['class', 'id'],
    'h6': ['class', 'id'],
    'table': ['class', 'id'],
    'tr': ['class', 'id'],
    'td': ['class', 'id'],
    'th': ['class', 'id'],
    'ul': ['class', 'id'],
    'ol': ['class', 'id'],
    'li': ['class', 'id']
  };

  /**
   * Main sanitization method with comprehensive XSS protection
   */
  static sanitize(input: string, options: SanitizationOptions = {}): SanitizationResult {
    const {
      allowedTags = [],
      allowedAttributes = {},
      maxLength = 50000,
      preserveWhitespace = false,
      strictMode = true
    } = options;

    const warnings: string[] = [];
    const removedElements: string[] = [];

    if (!input || typeof input !== 'string') {
      return { sanitized: '', warnings: ['Invalid input'], removedElements: [] };
    }

    let sanitized = input;

    // Length check
    if (sanitized.length > maxLength) {
      sanitized = sanitized.slice(0, maxLength);
      warnings.push(`Input truncated to ${maxLength} characters`);
    }

    // Remove dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      const matches = sanitized.match(pattern);
      if (matches) {
        removedElements.push(...matches);
        sanitized = sanitized.replace(pattern, '');
      }
    }

    // Handle HTML tags if any are allowed
    if (allowedTags.length > 0) {
      sanitized = this.sanitizeHTML(sanitized, allowedTags, allowedAttributes, warnings, removedElements);
    } else if (strictMode) {
      // In strict mode, escape all HTML
      sanitized = this.escapeHTML(sanitized);
    }

    // Remove dangerous attributes from any remaining tags
    sanitized = this.removeDangerousAttributes(sanitized, warnings);

    // Additional encoding for special cases
    sanitized = this.additionalEncoding(sanitized);

    // Normalize whitespace if requested
    if (!preserveWhitespace) {
      sanitized = sanitized.replace(/\s+/g, ' ').trim();
    }

    return { sanitized, warnings, removedElements };
  }

  /**
   * Sanitize HTML while preserving allowed tags
   */
  private static sanitizeHTML(
    input: string,
    allowedTags: string[],
    allowedAttributes: Record<string, string[]>,
    warnings: string[],
    removedElements: string[]
  ): string {
    // Use DOM parser for safer HTML processing
    if (typeof window !== 'undefined' && window.DOMParser) {
      return this.domBasedSanitization(input, allowedTags, allowedAttributes, warnings, removedElements);
    }
    
    // Fallback to regex-based sanitization
    return this.regexBasedSanitization(input, allowedTags, allowedAttributes, warnings, removedElements);
  }

  /**
   * DOM-based sanitization (preferred when available)
   */
  private static domBasedSanitization(
    input: string,
    allowedTags: string[],
    allowedAttributes: Record<string, string[]>,
    warnings: string[],
    removedElements: string[]
  ): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${input}</div>`, 'text/html');
    
    this.sanitizeElement(doc.body.firstElementChild as Element, allowedTags, allowedAttributes, warnings, removedElements);
    
    return (doc.body.firstElementChild as Element).innerHTML;
  }

  /**
   * Recursively sanitize DOM elements
   */
  private static sanitizeElement(
    element: Element,
    allowedTags: string[],
    allowedAttributes: Record<string, string[]>,
    warnings: string[],
    removedElements: string[]
  ): void {
    const children = Array.from(element.children);
    
    for (const child of children) {
      const tagName = child.tagName.toLowerCase();
      
      if (!allowedTags.includes(tagName)) {
        removedElements.push(`<${tagName}>`);
        child.remove();
        continue;
      }
      
      // Remove dangerous attributes
      const attributes = Array.from(child.attributes);
      for (const attr of attributes) {
        const attrName = attr.name.toLowerCase();
        const allowedAttrs = allowedAttributes[tagName] || this.SAFE_ATTRIBUTES[tagName] || [];
        
        if (!allowedAttrs.includes(attrName) || this.DANGEROUS_ATTRIBUTES.includes(attrName)) {
          child.removeAttribute(attr.name);
          warnings.push(`Removed attribute ${attrName} from ${tagName}`);
        }
      }
      
      // Recursively sanitize children
      this.sanitizeElement(child, allowedTags, allowedAttributes, warnings, removedElements);
    }
  }

  /**
   * Regex-based sanitization (fallback)
   */
  private static regexBasedSanitization(
    input: string,
    allowedTags: string[],
    allowedAttributes: Record<string, string[]>,
    warnings: string[],
    removedElements: string[]
  ): string {
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>/gi;
    
    return input.replace(tagRegex, (match, tagName) => {
      if (!allowedTags.includes(tagName.toLowerCase())) {
        removedElements.push(match);
        return '';
      }
      
      // Remove dangerous attributes from allowed tags
      return this.sanitizeTagAttributes(match, tagName, allowedAttributes[tagName.toLowerCase()] || [], warnings);
    });
  }

  /**
   * Sanitize attributes within a tag
   */
  private static sanitizeTagAttributes(tag: string, tagName: string, allowedAttrs: string[], warnings: string[]): string {
    const attrRegex = /\s+([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*["']([^"']*)["']/g;
    
    return tag.replace(attrRegex, (match, attrName, attrValue) => {
      const lowerAttrName = attrName.toLowerCase();
      
      if (!allowedAttrs.includes(lowerAttrName) || this.DANGEROUS_ATTRIBUTES.includes(lowerAttrName)) {
        warnings.push(`Removed attribute ${attrName} from ${tagName}`);
        return '';
      }
      
      // Additional value sanitization
      const sanitizedValue = this.sanitizeAttributeValue(attrValue, lowerAttrName);
      return ` ${attrName}="${sanitizedValue}"`;
    });
  }

  /**
   * Sanitize attribute values
   */
  private static sanitizeAttributeValue(value: string, attrName: string): string {
    // Remove javascript: and other dangerous protocols
    value = value.replace(/javascript\s*:/gi, '');
    value = value.replace(/vbscript\s*:/gi, '');
    value = value.replace(/data\s*:\s*text\/html/gi, '');
    
    // For class and id attributes, only allow alphanumeric, hyphens, and underscores
    if (attrName === 'class' || attrName === 'id') {
      value = value.replace(/[^a-zA-Z0-9\s\-_]/g, '');
    }
    
    return value;
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
   * Remove dangerous attributes from any remaining tags
   */
  private static removeDangerousAttributes(input: string, warnings: string[]): string {
    const dangerousAttrRegex = new RegExp(`\\s+(${this.DANGEROUS_ATTRIBUTES.join('|')})\\s*=\\s*["'][^"']*["']`, 'gi');
    
    return input.replace(dangerousAttrRegex, (match, attrName) => {
      warnings.push(`Removed dangerous attribute: ${attrName}`);
      return '';
    });
  }

  /**
   * Additional encoding for edge cases
   */
  private static additionalEncoding(input: string): string {
    // Encode Unicode control characters
    input = input.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    // Encode NULL bytes and other problematic characters
    input = input.replace(/\x00/g, '');
    input = input.replace(/\uFEFF/g, ''); // BOM
    input = input.replace(/\u2028/g, ''); // Line separator
    input = input.replace(/\u2029/g, ''); // Paragraph separator
    
    return input;
  }

  /**
   * Quick sanitization for simple text input
   */
  static sanitizeText(input: string, maxLength: number = 10000): string {
    if (!input || typeof input !== 'string') return '';
    
    return this.escapeHTML(input.slice(0, maxLength).trim());
  }

  /**
   * Sanitize for URL contexts
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
   * Sanitize CSS values
   */
  static sanitizeCSS(css: string): string {
    if (!css || typeof css !== 'string') return '';
    
    // Remove dangerous CSS functions and properties
    css = css.replace(/expression\s*\(/gi, '');
    css = css.replace(/javascript\s*:/gi, '');
    css = css.replace(/@import/gi, '');
    css = css.replace(/binding\s*:/gi, '');
    css = css.replace(/-moz-binding/gi, '');
    css = css.replace(/url\s*\(\s*["']?\s*javascript:/gi, '');
    
    return css;
  }
}

export default EnhancedXSSSanitizer;