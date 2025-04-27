
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

interface TurnstileResponse {
  "error-codes": string[];
  success: boolean;
  action: string;
  cdata: string;
}

const TURNSTILE_SECRET_KEY = Deno.env.get("TURNSTILE_SECRET_KEY")!;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { 
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  try {
    const { token, ip } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const formData = new FormData();
    formData.append("secret", TURNSTILE_SECRET_KEY);
    formData.append("response", token);
    if (ip) formData.append("remoteip", ip);

    console.log("Verifying Turnstile token...");
    const result = await fetch(TURNSTILE_VERIFY_URL, {
      body: formData,
      method: "POST",
    });

    const data: TurnstileResponse = await result.json();
    console.log("Turnstile response:", data);

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

    return new Response(
      JSON.stringify({ success: true }),
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
    "internal-error": "An internal error occurred while validating the response"
  };
  
  return errorMessages[errorCode] || "Unknown error occurred";
}
