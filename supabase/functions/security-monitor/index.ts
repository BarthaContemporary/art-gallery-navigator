import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 5 * 60 * 1000 // 5 minutes
const RATE_LIMIT_MAX = 100 // Max requests per window

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const clientIP = req.headers.get('x-forwarded-for') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'
    
    // Rate limiting check
    const now = Date.now()
    const rateLimitKey = clientIP
    const rateLimitInfo = rateLimitStore.get(rateLimitKey)
    
    if (rateLimitInfo) {
      if (now < rateLimitInfo.resetTime) {
        if (rateLimitInfo.count >= RATE_LIMIT_MAX) {
          // Log rate limit violation
          await supabase.rpc('enhanced_log_security_event', {
            _event_type: 'rate_limit_exceeded',
            _severity: 'warning',
            _ip_address: clientIP,
            _user_agent: userAgent,
            _details: { limit: RATE_LIMIT_MAX, window: RATE_LIMIT_WINDOW }
          })
          
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded' }), 
            { 
              status: 429, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
        rateLimitInfo.count++
      } else {
        // Reset window
        rateLimitStore.set(rateLimitKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
      }
    } else {
      rateLimitStore.set(rateLimitKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    }

    if (req.method === 'POST') {
      const { eventType, severity, details, userId } = await req.json()
      
      // Validate input
      if (!eventType || !severity) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: eventType, severity' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Enhanced security logging with additional context
      const { data, error } = await supabase.rpc('enhanced_log_security_event', {
        _event_type: eventType,
        _severity: severity,
        _ip_address: clientIP,
        _user_agent: userAgent,
        _details: {
          ...details,
          timestamp: now,
          request_id: crypto.randomUUID(),
          source: 'security_monitor_edge_function'
        }
      })

      if (error) {
        console.error('Database logging error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to log security event' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Additional monitoring for critical events
      if (severity === 'critical') {
        console.log(`🚨 CRITICAL SECURITY EVENT: ${eventType}`)
        console.log(`Details:`, details)
        console.log(`IP: ${clientIP}, User Agent: ${userAgent}`)
        
        // Could send alerts to external monitoring services here
        // await sendAlertToSlack(eventType, details)
        // await sendAlertToEmail(eventType, details)
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          eventId: data,
          timestamp: now 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'GET') {
      // Get recent security events summary
      const { data: events, error } = await supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch security events' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Generate summary statistics
      const summary = {
        totalEvents: events.length,
        criticalEvents: events.filter(e => e.event_type.includes('_critical')).length,
        warningEvents: events.filter(e => e.event_type.includes('_warning')).length,
        infoEvents: events.filter(e => e.event_type.includes('_info')).length,
        recentEvents: events.slice(0, 10),
        topEventTypes: getTopEventTypes(events),
        uniqueUsers: [...new Set(events.map(e => e.user_id).filter(Boolean))].length
      }

      return new Response(
        JSON.stringify(summary),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Security monitor error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function getTopEventTypes(events: any[]): Record<string, number> {
  const counts: Record<string, number> = {}
  events.forEach(event => {
    const baseType = event.event_type.split('_')[0]
    counts[baseType] = (counts[baseType] || 0) + 1
  })
  
  return Object.entries(counts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .reduce((obj, [type, count]) => {
      obj[type] = count
      return obj
    }, {} as Record<string, number>)
}