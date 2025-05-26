
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { logger } from "../_shared/logger.ts"; // Assuming a shared logger, adjust if not present

const TURNSTILE_SECRET_KEY = Deno.env.get("TURNSTILE_SECRET_KEY");
const TURNSTILE_VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  logger.log("verify-turnstile function invoked", { method: req.method });

  if (req.method === "OPTIONS") {
    logger.log("Handling OPTIONS request");
    return new Response(null, { headers: corsHeaders });
  }

  if (!TURNSTILE_SECRET_KEY) {
    logger.error("TURNSTILE_SECRET_KEY is not set in environment variables.");
    return new Response(
      JSON.stringify({ error: "Internal server error: Missing secret key" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let token;
  try {
    const body = await req.json();
    token = body.token;
    logger.log("Received token for verification:", token ? "Present" : "Absent");
  } catch (error) {
    logger.error("Failed to parse request body:", error);
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!token) {
    logger.warn("No token provided in the request.");
    return new Response(
      JSON.stringify({ error: "CAPTCHA token is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const formData = new FormData();
    formData.append("secret", TURNSTILE_SECRET_KEY);
    formData.append("response", token);
    // Optionally, pass the user's IP address (req.headers.get('x-forwarded-for'))
    // formData.append("remoteip", req.headers.get('x-forwarded-for'));

    logger.log("Verifying token with Cloudflare...");
    const response = await fetch(TURNSTILE_VERIFY_ENDPOINT, {
      method: "POST",
      body: formData,
    });

    const outcome = await response.json();
    logger.log("Cloudflare verification outcome:", outcome);

    if (outcome.success) {
      return new Response(
        JSON.stringify({ success: true, message: "CAPTCHA verified successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "CAPTCHA verification failed", "error-codes": outcome["error-codes"] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    logger.error("Error during CAPTCHA verification:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error during CAPTCHA verification" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
