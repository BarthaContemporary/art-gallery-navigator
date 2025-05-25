
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
const ALLOWED_DOMAINS: string[] = []; // Keep as per original: empty array allows any domain

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEVELOPMENT_MODE = false; // Keep as per original
const DEVELOPMENT_TOKEN = "development-mode";

// Helper function to debug domain issues (kept from original)
function logDomainInfo(requestDomain: string | undefined, responseDomain: string | undefined, body: any) {
  console.log("======== Domain Debug Info ========");
  console.log(`Request domain: ${requestDomain || 'undefined'}`);
  console.log(`Response hostname: ${responseDomain || 'undefined'}`);
  console.log(`Request origin: ${body.origin || 'undefined'}`);
  console.log(`Request URL: ${body.url || 'undefined'}`);
  console.log("==================================");
}

// Helper function to get error messages (kept from original)
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

// New helper functions for refactoring

function buildJsonResponse(status: number, body: Record<string, any>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function validateAndParseRequest(req: Request): Promise<{ body: VerificationRequest | null, errorResponse: Response | null }> {
  if (req.method !== "POST") {
    console.log(`Invalid method: ${req.method}`);
    return { body: null, errorResponse: buildJsonResponse(405, { error: "Method not allowed" }) };
  }

  try {
    const body: VerificationRequest = await req.json();
    console.log(`Verifying token with provided domain: ${body.domain || 'none'}`);
    console.log(`Client origin: ${body.origin || 'none'}`);
    console.log(`Client URL: ${body.url || 'none'}`);

    if (!body.token) {
      console.error("Token is missing");
      return { body: null, errorResponse: buildJsonResponse(400, { error: "Token is required" }) };
    }
    return { body, errorResponse: null };
  } catch (e) {
    console.error("Error parsing request body:", e);
    return { body: null, errorResponse: buildJsonResponse(400, { error: "Invalid request body" }) };
  }
}

function handleDevelopmentMode(token: string, domain?: string): Response | null {
  if (DEVELOPMENT_MODE && token === DEVELOPMENT_TOKEN) {
    console.log("Development mode token accepted");
    return buildJsonResponse(200, {
      success: true,
      hostname: domain || "development.local",
      message: "Development mode verification successful",
    });
  }
  return null;
}

function checkAllowedDomain(domain?: string): Response | null {
  if (ALLOWED_DOMAINS.length > 0 && domain && !ALLOWED_DOMAINS.includes(domain)) {
    console.error(`Domain validation failed: ${domain} is not in allowed list`);
    return buildJsonResponse(403, {
      error: "Domain validation failed",
      details: ["invalid-domain"],
      message: `${domain} is not authorized for CAPTCHA verification`,
    });
  }
  return null;
}

async function callTurnstileApi(token: string, domain?: string, ip?: string): Promise<{ data: TurnstileResponse | null, errorResponse: Response | null }> {
  const formData = new FormData();
  formData.append("secret", TURNSTILE_SECRET_KEY);
  formData.append("response", token);
  if (domain) formData.append("domain", domain);
  if (ip) formData.append("remoteip", ip);

  console.log("Sending verification request to Turnstile API...");
  try {
    const result = await fetch(TURNSTILE_VERIFY_URL, {
      body: formData,
      method: "POST",
    });

    if (!result.ok) {
      console.error(`Turnstile API request failed with status ${result.status}`);
      return {
        data: null,
        errorResponse: buildJsonResponse(502, {
          error: "CAPTCHA service error",
          details: [`api-error-${result.status}`],
          message: `Error contacting verification service: ${result.statusText}`,
        }),
      };
    }
    const data: TurnstileResponse = await result.json();
    console.log("Turnstile response:", JSON.stringify(data));
    return { data, errorResponse: null };
  } catch (fetchError) {
    console.error("Error fetching Turnstile API:", fetchError);
    return {
      data: null,
      errorResponse: buildJsonResponse(500, {
        error: "CAPTCHA service connection error",
        message: fetchError instanceof Error ? fetchError.message : "Unknown error during API call",
      }),
    };
  }
}

function processTurnstileVerification(
  turnstileData: TurnstileResponse,
  requestDomain: string | undefined,
  requestBody: VerificationRequest
): Response {
  logDomainInfo(requestDomain, turnstileData.hostname, requestBody);

  if (turnstileData.hostname && requestDomain && turnstileData.hostname !== requestDomain) {
    console.error(`Domain mismatch: requested ${requestDomain}, got ${turnstileData.hostname}`);
    return buildJsonResponse(403, {
      error: "Domain validation failed",
      details: ["hostname-mismatch"],
      message: `Domain mismatch: widget is configured for ${turnstileData.hostname} but request came from ${requestDomain}. Check your Turnstile site settings.`,
    });
  }

  if (!turnstileData.success) {
    console.error("Turnstile verification failed:", {
      errors: turnstileData["error-codes"],
      token: requestBody.token.substring(0, 10) + "...",
      domain: requestDomain || 'not provided',
    });
    return buildJsonResponse(400, {
      error: "CAPTCHA verification failed",
      details: turnstileData["error-codes"],
      message: getTurnstileErrorMessage(turnstileData["error-codes"][0]),
    });
  }

  console.log("Turnstile verification successful");
  return buildJsonResponse(200, {
    success: true,
    hostname: turnstileData.hostname,
    message: "Verification successful",
  });
}


serve(async (req) => {
  console.log("Turnstile verification request received");

  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { body: requestBody, errorResponse: validationError } = await validateAndParseRequest(req);
    if (validationError) return validationError;
    // requestBody is guaranteed to be non-null here if validationError is null
    const { token, domain, ip } = requestBody!;

    const devModeResponse = handleDevelopmentMode(token, domain);
    if (devModeResponse) return devModeResponse;

    const domainCheckResponse = checkAllowedDomain(domain);
    if (domainCheckResponse) return domainCheckResponse;

    const { data: turnstileData, errorResponse: apiCallError } = await callTurnstileApi(token, domain, ip);
    if (apiCallError) return apiCallError;
    // turnstileData is guaranteed to be non-null here
    
    return processTurnstileVerification(turnstileData!, domain, requestBody!);

  } catch (error) {
    // This catch block is for unexpected errors not caught by helper functions
    console.error("Unexpected error in Turnstile verification process:", error);
    return buildJsonResponse(500, {
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});
