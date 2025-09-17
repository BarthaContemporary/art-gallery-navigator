// Enhanced security headers configuration
export const ENHANCED_SECURITY_HEADERS = {
  // Content Security Policy - Enhanced with stricter rules
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: http:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
    "frame-src 'self' https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
    "block-all-mixed-content"
  ].join('; '),
  
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // XSS Protection
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer policy for privacy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // HSTS for HTTPS enforcement
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // Permissions policy to restrict dangerous features
  'Permissions-Policy': [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
    'autoplay=()',
    'fullscreen=(self)',
    'picture-in-picture=()'
  ].join(', '),
  
  // Cross-Origin policies
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  
  // Cache control for sensitive pages
  'Cache-Control': 'no-cache, no-store, must-revalidate, private',
  'Pragma': 'no-cache',
  'Expires': '0'
} as const;

// Apply enhanced security headers to all responses
export function applyEnhancedSecurityHeaders(headers?: HeadersInit): HeadersInit {
  return {
    ...ENHANCED_SECURITY_HEADERS,
    ...headers
  };
}

// Security middleware for API routes
export function securityMiddleware(request: Request): Response | null {
  const url = new URL(request.url);
  
  // Block requests with suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /javascript:/i, // JavaScript protocol
    /data:.*base64/i // Data URL attacks
  ];
  
  const fullUrl = url.pathname + url.search;
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(fullUrl)) {
      return new Response('Forbidden', { 
        status: 403,
        headers: applyEnhancedSecurityHeaders()
      });
    }
  }
  
  return null; // Continue processing
}

// Rate limiting configuration
export const RATE_LIMITS = {
  auth: { requests: 5, window: 15 * 60 * 1000 }, // 5 requests per 15 minutes
  api: { requests: 100, window: 60 * 1000 }, // 100 requests per minute
  upload: { requests: 10, window: 60 * 1000 } // 10 uploads per minute
} as const;