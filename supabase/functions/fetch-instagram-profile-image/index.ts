
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InstagramProfileRequest {
  username: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username }: InstagramProfileRequest = await req.json();
    
    if (!username) {
      throw new Error("Username is required");
    }

    // Clean username (remove @ if present)
    const cleanUsername = username.replace('@', '');
    
    // Use Instagram's public profile endpoint to get basic info
    // Note: This is a simplified approach. For production, you'd want to use Instagram Basic Display API
    const instagramUrl = `https://www.instagram.com/${cleanUsername}/?__a=1`;
    
    const response = await fetch(instagramUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ProfileImageBot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error("Profile not found or private");
    }

    const data = await response.json();
    const profileImageUrl = data?.graphql?.user?.profile_pic_url_hd || data?.graphql?.user?.profile_pic_url;
    
    if (profileImageUrl) {
      return new Response(JSON.stringify({ imageUrl: profileImageUrl }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    } else {
      throw new Error("Profile image not found");
    }
  } catch (error: any) {
    console.error("Error fetching Instagram profile image:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
