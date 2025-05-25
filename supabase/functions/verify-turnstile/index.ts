import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

interface TurnstileResponse {
  "error-codes": string[];
  success: boolean;
  action: string;
  cdata: string;
  hostname?: string;
}

interface VerificationRequest {
  token: string;
  domain?: string;
  ip?: string;
  origin?: string;
  url?: string;
}

const TURNSTILE_SECRET_KEY = Deno.env.get("TURNSTILE_SECRET_KEY")!;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
// List of allowed domains - use empty array to allow any domain
// When testing locally, you might need to add localhost or your test domain here
const ALLOWED_DOMAINS: string[] = [];

// Define CORS headers - make sure to allow all necessary origins for development/testing
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Development mode flag - set to false to disable development mode
const DEVELOPMENT_MODE = false; // Changed to false
const DEVELOPMENT_TOKEN = "development-mode";

// Helper function to debug domain issues
function logDomainInfo(requestDomain: string | undefined, responseDomain: string | undefined, body: any) {
  console.log("======== Domain Debug Info ========");
  console.log(`Request domain: ${requestDomain || 'undefined'}`);
  console.log(`Response hostname: ${responseDomain || 'undefined'}`);
  console.log(`Request origin: ${body.origin || 'undefined'}`);
  console.log(`Request URL: ${body.url || 'undefined'}`);
  console.log("==================================");
}

serve(async (req) => {
  console.log("Turnstile verification request received");
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (req.method !== "POST") {
    console.log(`Invalid method: ${req.method}`);
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { 
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  try {
    const body: VerificationRequest = await req.json();
    const { token, domain, ip, origin, url } = body;
    console.log(`Verifying token with provided domain: ${domain || 'none'}`);
    console.log(`Client origin: ${origin || 'none'}`);
    console.log(`Client URL: ${url || 'none'}`);

    if (!token) {
      console.error("Token is missing");
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Special case for development mode (now effectively disabled by DEVELOPMENT_MODE = false)
    if (DEVELOPMENT_MODE && token === DEVELOPMENT_TOKEN) {
      console.log("Development mode token accepted");
      return new Response(
        JSON.stringify({
          success: true,
          hostname: domain || "development.local",
          message: "Development mode verification successful"
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Check if domain is valid (if domain restriction is enabled)
    if (ALLOWED_DOMAINS.length > 0 && domain && !ALLOWED_DOMAINS.includes(domain)) {
      console.error(`Domain validation failed: ${domain} is not in allowed list`);
      return new Response(
        JSON.stringify({ 
          error: "Domain validation failed",
          details: ["invalid-domain"],
          message: `${domain} is not authorized for CAPTCHA verification`
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const formData = new FormData();
    formData.append("secret", TURNSTILE_SECRET_KEY);
    formData.append("response", token);
    if (domain) formData.append("domain", domain);
    if (ip) formData.append("remoteip", ip);

    console.log("Sending verification request to Turnstile API...");
    const result = await fetch(TURNSTILE_VERIFY_URL, {
      body: formData,
      method: "POST",
    });

    if (!result.ok) {
      console.error(`Turnstile API request failed with status ${result.status}`);
      return new Response(
        JSON.stringify({ 
          error: "CAPTCHA service error",
          details: [`api-error-${result.status}`],
          message: `Error contacting verification service: ${result.statusText}`
        }),
        { 
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const data: TurnstileResponse = await result.json();
    console.log("Turnstile response:", JSON.stringify(data));
    
    // Log detailed domain information for debugging
    logDomainInfo(domain, data.hostname, body);

    // Check for hostname mismatch
    if (data.hostname && domain && data.hostname !== domain) {
      console.error(`Domain mismatch: requested ${domain}, got ${data.hostname}`);
      return new Response(
        JSON.stringify({ 
          error: "Domain validation failed",
          details: ["hostname-mismatch"],
          message: `Domain mismatch: widget is configured for ${data.hostname} but request came from ${domain}. Check your Turnstile site settings.`
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    if (!data.success) {
      console.error("Turnstile verification failed:", {
        errors: data["error-codes"],
        token: token.substring(0, 10) + "...", // Log partial token for debugging
        domain: domain || 'not provided'
      });
      
      return new Response(
        JSON.stringify({ 
          error: "CAPTCHA verification failed",
          details: data["error-codes"],
          message: getTurnstileErrorMessage(data["error-codes"][0])
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log("Turnstile verification successful");
    return new Response(
      JSON.stringify({ 
        success: true, 
        hostname: data.hostname,
        message: "Verification successful"
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Error verifying Turnstile token:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

function getTurnstileErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    "missing-input-secret": "The secret key is missing",
    "invalid-input-secret": "The secret key is invalid or expired",
    "missing-input-response": "The CAPTCHA response parameter is missing",
    "invalid-input-response": "The CAPTCHA response parameter is invalid or has incorrect format",
    "bad-request": "The request is invalid or malformed",
    "timeout-or-duplicate": "The response is no longer valid: either is too old or has been used previously",
    "internal-error": "An internal error occurred while validating the response",
    "invalid-domain": "Domain validation failed - check your Turnstile site configuration",
    "sitekey-secret-mismatch": "The sitekey is not registered with the provided secret",
    "hostname-mismatch": "Domain mismatch detected between widget and verification request"
  };
  
  return errorMessages[errorCode] || `Unknown error occurred (code: ${errorCode})`;
}
