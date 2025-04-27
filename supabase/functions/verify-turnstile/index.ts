
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

interface TurnstileResponse {
  "error-codes": string[];
  success: boolean;
  action: string;
  cdata: string;
  hostname?: string;
}

const TURNSTILE_SECRET_KEY = Deno.env.get("TURNSTILE_SECRET_KEY")!;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
// List of allowed domains - use empty array to allow any domain
const ALLOWED_DOMAINS: string[] = [];

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
    const { token, ip, domain } = await req.json();
    console.log(`Verifying token with provided domain: ${domain}`);

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
          message: "Error contacting verification service"
        }),
        { 
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const data: TurnstileResponse = await result.json();
    console.log("Turnstile response:", JSON.stringify(data));

    // Check for hostname mismatch
    if (data.hostname && domain && data.hostname !== domain) {
      console.error(`Domain mismatch: expected ${domain}, got ${data.hostname}`);
      return new Response(
        JSON.stringify({ 
          error: "Domain validation failed",
          details: ["hostname-mismatch"],
          message: `Domain mismatch: widget is configured for ${data.hostname}`
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
        token: token.substring(0, 10) + "..." // Log partial token for debugging
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
      JSON.stringify({ success: true, hostname: data.hostname }),
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
    "invalid-input-secret": "The secret key is invalid",
    "missing-input-response": "The response parameter is missing",
    "invalid-input-response": "The response parameter is invalid",
    "bad-request": "The request is invalid or malformed",
    "timeout-or-duplicate": "The response is no longer valid: either is too old or has been used previously",
    "internal-error": "An internal error occurred while validating the response",
    "invalid-domain": "Domain validation failed - check your Turnstile site configuration",
    "sitekey-secret-mismatch": "The sitekey is not registered with the provided secret"
  };
  
  return errorMessages[errorCode] || "Unknown error occurred";
}
