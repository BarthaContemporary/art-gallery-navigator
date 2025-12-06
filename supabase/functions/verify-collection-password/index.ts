import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple rate limiting map (in production, use Redis or similar)
const attemptMap = new Map<string, { count: number; lastAttempt: number; blockedUntil?: number }>();
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(identifier: string): { blocked: boolean; remainingAttempts: number } {
  const now = Date.now();
  const record = attemptMap.get(identifier);
  
  if (!record) {
    return { blocked: false, remainingAttempts: MAX_ATTEMPTS };
  }
  
  // Check if currently blocked
  if (record.blockedUntil && now < record.blockedUntil) {
    return { blocked: true, remainingAttempts: 0 };
  }
  
  // Reset if block has expired
  if (record.blockedUntil && now >= record.blockedUntil) {
    attemptMap.delete(identifier);
    return { blocked: false, remainingAttempts: MAX_ATTEMPTS };
  }
  
  // Reset if attempt window has passed
  if (now - record.lastAttempt > ATTEMPT_WINDOW_MS) {
    attemptMap.delete(identifier);
    return { blocked: false, remainingAttempts: MAX_ATTEMPTS };
  }
  
  return { blocked: false, remainingAttempts: MAX_ATTEMPTS - record.count };
}

function recordAttempt(identifier: string, success: boolean): void {
  const now = Date.now();
  
  if (success) {
    attemptMap.delete(identifier);
    return;
  }
  
  const record = attemptMap.get(identifier) || { count: 0, lastAttempt: now };
  record.count += 1;
  record.lastAttempt = now;
  
  if (record.count >= MAX_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_DURATION_MS;
    console.log(`[SECURITY] Rate limit exceeded for identifier: ${identifier.substring(0, 8)}...`);
  }
  
  attemptMap.set(identifier, record);
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  console.log("[verify-collection-password] Request received:", req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  try {
    const { slug, password } = await req.json();
    
    if (!slug || typeof slug !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid slug" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!password || typeof password !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Password is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get client IP for rate limiting
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const identifier = `${slug}:${clientIP}`;
    
    // Check rate limit
    const rateLimit = checkRateLimit(identifier);
    if (rateLimit.blocked) {
      console.log(`[SECURITY] Blocked request from ${identifier.substring(0, 8)}...`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Too many failed attempts. Please try again later.",
          blocked: true 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Create Supabase client with service role to access password_hash
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Fetch the collection website with password hash (admin access)
    const { data: website, error } = await supabase
      .from("collection_websites")
      .select("id, slug, password_hash, is_active")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();
    
    if (error || !website) {
      console.log(`[verify-collection-password] Website not found: ${slug}`);
      return new Response(
        JSON.stringify({ success: false, error: "Collection not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!website.password_hash) {
      // No password required
      return new Response(
        JSON.stringify({ success: true, message: "No password required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Hash the provided password and compare
    const providedHash = await hashPassword(password);
    const isValid = providedHash === website.password_hash;
    
    // Record the attempt
    recordAttempt(identifier, isValid);
    
    if (isValid) {
      console.log(`[verify-collection-password] Password verified for: ${slug}`);
      return new Response(
        JSON.stringify({ success: true, message: "Password verified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const remaining = checkRateLimit(identifier).remainingAttempts;
      console.log(`[verify-collection-password] Invalid password for: ${slug}, remaining: ${remaining}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid password",
          remainingAttempts: remaining
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
  } catch (error) {
    console.error("[verify-collection-password] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
