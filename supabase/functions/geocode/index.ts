
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('Missing authorization header')
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('Authentication failed:', authError?.message)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Authenticated user: ${user.id}`)

    if (!GOOGLE_MAPS_API_KEY) {
      console.error('Google Maps API key not configured')
      throw new Error('Google Maps API key not configured')
    }

    const { address } = await req.json()
    
    if (!address) {
      throw new Error('Address is required')
    }

    const encodedAddress = encodeURIComponent(address)
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`
    
    console.log('Geocoding address:', address)
    console.log('Geocoding URL (without key):', `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=***`)
    
    const response = await fetch(geocodeUrl)
    
    if (!response.ok) {
      console.error('Geocoding API response not ok:', response.status, response.statusText)
      throw new Error(`Geocoding API error: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    console.log('Geocoding API response status:', data.status)
    
    if (data.status === 'ZERO_RESULTS') {
      console.log('No results found for address:', address)
      return new Response(
        JSON.stringify({ error: 'Address not found', results: [] }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    if (data.status === 'REQUEST_DENIED') {
      console.error('Geocoding request denied:', data.error_message)
      throw new Error(`Geocoding request denied: ${data.error_message}`)
    }
    
    if (data.status === 'INVALID_REQUEST') {
      console.error('Invalid geocoding request:', data.error_message)
      throw new Error(`Invalid request: ${data.error_message}`)
    }
    
    if (data.status === 'OVER_QUERY_LIMIT') {
      console.error('Geocoding query limit exceeded')
      throw new Error('Geocoding service temporarily unavailable')
    }
    
    if (data.status !== 'OK') {
      console.error('Geocoding failed with status:', data.status, data.error_message)
      throw new Error(`Geocoding failed: ${data.status}`)
    }
    
    if (!data.results || data.results.length === 0) {
      console.log('No results in response despite OK status')
      throw new Error('No results found')
    }
    
    console.log('Geocoding successful:', data.results[0]?.formatted_address)
    
    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Geocoding error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
