
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Rate limiting storage
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(identifier: string, maxRequests: number = 5, windowMs: number = 60000): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(identifier)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (record.count >= maxRequests) {
    return false
  }
  
  record.count++
  return true
}

async function logSecurityEvent(
  eventType: string,
  details: any,
  userId?: string,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await supabase.rpc('log_security_event', {
      _event_type: eventType,
      _ip_address: ipAddress,
      _user_agent: userAgent,
      _details: details
    })
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}

function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input')
  }
  return input.trim().slice(0, 1000) // Limit length
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get client IP and user agent for rate limiting and logging
    const clientIP = req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'
    
    // Rate limiting
    if (!checkRateLimit(clientIP, 10, 60000)) {
      await logSecurityEvent(
        'rate_limit_exceeded',
        { endpoint: 'hash-collection-password', ip: clientIP },
        undefined,
        clientIP,
        userAgent
      )
      
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      await logSecurityEvent(
        'unauthorized_access_attempt',
        { endpoint: 'hash-collection-password', reason: 'missing_auth_header' },
        undefined,
        clientIP,
        userAgent
      )
      
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      await logSecurityEvent(
        'unauthorized_access_attempt',
        { endpoint: 'hash-collection-password', reason: 'invalid_token' },
        undefined,
        clientIP,
        userAgent
      )
      
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if user is admin
    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'gallery_admin'
    })

    if (roleError || !isAdmin) {
      await logSecurityEvent(
        'unauthorized_access_attempt',
        { 
          endpoint: 'hash-collection-password', 
          reason: 'insufficient_permissions',
          userId: user.id 
        },
        user.id,
        clientIP,
        userAgent
      )
      
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { password } = await req.json()
    
    if (!password) {
      return new Response(
        JSON.stringify({ error: 'Password is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Sanitize input
    const sanitizedPassword = sanitizeInput(password)

    // Generate secure salt and hash the password using SHA-256 with salt
    // Note: For production, consider using bcrypt or Argon2 for stronger security
    const salt = crypto.getRandomValues(new Uint8Array(32))
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
    
    const encoder = new TextEncoder()
    const saltedPassword = saltHex + sanitizedPassword
    const data = encoder.encode(saltedPassword)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = saltHex + ':' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Log successful operation
    await logSecurityEvent(
      'password_hash_generated',
      { endpoint: 'hash-collection-password' },
      user.id,
      clientIP,
      userAgent
    )

    return new Response(
      JSON.stringify({ hash: hashHex }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in hash-collection-password function:', error)
    
    await logSecurityEvent(
      'function_error',
      { 
        endpoint: 'hash-collection-password',
        error: error.message 
      },
      undefined,
      req.headers.get('x-forwarded-for') || 'unknown',
      req.headers.get('user-agent') || 'unknown'
    )

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
