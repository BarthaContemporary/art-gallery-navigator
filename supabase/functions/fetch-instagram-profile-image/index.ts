
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
    console.log("Fetching Instagram profile image for:", cleanUsername);
    
    // Try multiple approaches to get Instagram profile image
    const instagramUrl = `https://www.instagram.com/${cleanUsername}/`;
    
    const response = await fetch(instagramUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      throw new Error("Profile not found or private");
    }

    const html = await response.text();
    let profileImageUrl = null;

    // Try to find profile image in various ways
    // Method 1: Look for Open Graph image
    const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
    if (ogImageMatch) {
      profileImageUrl = ogImageMatch[1];
    }

    // Method 2: Look for profile picture in JSON data
    if (!profileImageUrl) {
      const jsonMatch = html.match(/window\._sharedData\s*=\s*({.+?});/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          const user = data?.entry_data?.ProfilePage?.[0]?.graphql?.user;
          if (user?.profile_pic_url_hd) {
            profileImageUrl = user.profile_pic_url_hd;
          } else if (user?.profile_pic_url) {
            profileImageUrl = user.profile_pic_url;
          }
        } catch (e) {
          console.log("Failed to parse Instagram JSON data");
        }
      }
    }

    // Method 3: Look for profile image in meta tags
    if (!profileImageUrl) {
      const metaImageMatch = html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]*)"[^>]*>/i);
      if (metaImageMatch) {
        profileImageUrl = metaImageMatch[1];
      }
    }
    
    if (profileImageUrl) {
      console.log("Found Instagram image:", profileImageUrl);
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
