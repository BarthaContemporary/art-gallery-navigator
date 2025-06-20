import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const GOOGLE_API_URL = "https://docs.googleapis.com/v1/documents";
const GOOGLE_DRIVE_API_URL = "https://www.googleapis.com/drive/v3/files";

// Template document ID extracted from the URL
const TEMPLATE_DOCUMENT_ID = "1uHXsP9k-rkSGmfamNfS-LMy7hg6Xp_aMSPZVRkKtGpc";

interface ArtworkImage {
  id: string;
  artwork_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
  processed?: boolean;
  thumbnail_url?: string | null;
  medium_url?: string | null;
}

interface Artwork {
  id: string;
  title: string;
  artist_name?: string;
  year: number | null;
  medium_type: string;
  materials: string | null;
  dimensions: string | null;
  price: number | null;
  currency: string;
  status: string | null;
  location_id: string | null;
  artwork_images?: ArtworkImage[];
}

interface RequestBody {
  artworks: Artwork[];
  title?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artworks, title }: RequestBody = await req.json();
    
    if (!artworks || artworks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No artworks provided" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get Google API credentials from environment
    const googleCredentials = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!googleCredentials) {
      console.error("Google API credentials not found in environment");
      return new Response(
        JSON.stringify({ error: "Google API credentials not configured. Please add GOOGLE_SERVICE_ACCOUNT_KEY to your Supabase secrets." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let credentials;
    try {
      credentials = JSON.parse(googleCredentials);
      console.log("Google credentials parsed successfully");
    } catch (error) {
      console.error("Failed to parse Google credentials:", error);
      return new Response(
        JSON.stringify({ error: "Invalid Google API credentials format" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // Get access token
    console.log("Attempting to get Google access token...");
    const accessToken = await getGoogleAccessToken(credentials);
    console.log("Access token obtained successfully");
    
    // Copy the template document
    const docTitle = title || `Artwork List - ${new Date().toLocaleDateString()}`;
    console.log("Copying template document and creating new document with title:", docTitle);
    
    const copyDocResponse = await fetch(`${GOOGLE_DRIVE_API_URL}/${TEMPLATE_DOCUMENT_ID}/copy`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: docTitle
      })
    });

    console.log("Copy document response status:", copyDocResponse.status);
    
    if (!copyDocResponse.ok) {
      const errorText = await copyDocResponse.text();
      console.error("Failed to copy template document:", copyDocResponse.status, errorText);
      
      if (copyDocResponse.status === 403) {
        return new Response(
          JSON.stringify({ 
            error: "Google API access forbidden. Please ensure the Google Docs API and Drive API are enabled, and the service account has access to the template document." 
          }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      throw new Error(`Failed to copy template document: ${copyDocResponse.status} - ${errorText}`);
    }

    const docData = await copyDocResponse.json();
    const documentId = docData.id;
    console.log("Template document copied with new ID:", documentId);

    // Get the document content to find where to insert the artwork list
    console.log("Getting document content to find insertion point...");
    const getDocResponse = await fetch(`${GOOGLE_API_URL}/${documentId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      }
    });

    if (!getDocResponse.ok) {
      const errorText = await getDocResponse.text();
      console.error("Failed to get document content:", getDocResponse.status, errorText);
      throw new Error(`Failed to get document content: ${getDocResponse.status} - ${errorText}`);
    }

    const docContent = await getDocResponse.json();
    let currentIndex = docContent.body.content[docContent.body.content.length - 1].endIndex - 1;

    // Insert header content
    console.log("Inserting header content...");
    const headerContent = generateHeaderContent(artworks);
    await insertTextAtIndex(documentId, accessToken, currentIndex, "\n\n" + headerContent);
    currentIndex += headerContent.length + 2;

    // Process each artwork with images
    for (let i = 0; i < artworks.length; i++) {
      const artwork = artworks[i];
      console.log(`Processing artwork ${i + 1}: ${artwork.title}`);
      
      // Insert artwork text content
      const artworkContent = generateArtworkContent(artwork, i + 1);
      await insertTextAtIndex(documentId, accessToken, currentIndex, "\n\n" + artworkContent);
      currentIndex += artworkContent.length + 2;
      
      // Insert image if available
      if (artwork.artwork_images && artwork.artwork_images.length > 0) {
        const primaryImage = artwork.artwork_images.find(img => img.is_primary);
        const imageToUse = primaryImage || artwork.artwork_images[0];
        const imageUrl = imageToUse.medium_url || imageToUse.image_url;
        
        if (imageUrl) {
          console.log(`Inserting image for artwork: ${artwork.title}`);
          try {
            await insertImageAtIndex(documentId, accessToken, currentIndex, imageUrl);
            currentIndex += 1; // Account for the inserted image
          } catch (error) {
            console.warn(`Failed to insert image for artwork ${artwork.title}:`, error);
            // Continue with next artwork even if image insertion fails
          }
        }
      }
    }

    console.log("Document content updated successfully");

    // Make the document publicly viewable
    console.log("Making document publicly viewable...");
    const permissionResponse = await fetch(`${GOOGLE_DRIVE_API_URL}/${documentId}/permissions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "reader",
        type: "anyone"
      })
    });

    if (!permissionResponse.ok) {
      const errorText = await permissionResponse.text();
      console.warn("Failed to make document public (proceeding anyway):", permissionResponse.status, errorText);
    } else {
      console.log("Document made publicly viewable");
    }

    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
    console.log("Document URL:", documentUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        documentUrl,
        documentId,
        artworkCount: artworks.length
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error("Error creating artwork Google Doc:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: "Check the function logs for more information"
      }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
};

async function insertTextAtIndex(documentId: string, accessToken: string, index: number, text: string) {
  const response = await fetch(`${GOOGLE_API_URL}/${documentId}:batchUpdate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index },
            text
          }
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to insert text: ${response.status} - ${errorText}`);
  }
}

async function insertImageAtIndex(documentId: string, accessToken: string, index: number, imageUrl: string) {
  // Convert 4cm to points (1 cm = 28.35 points)
  const maxHeightPoints = 4 * 28.35;
  
  const response = await fetch(`${GOOGLE_API_URL}/${documentId}:batchUpdate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          insertInlineImage: {
            location: { index },
            uri: imageUrl,
            objectSize: {
              height: {
                magnitude: maxHeightPoints,
                unit: "PT"
              },
              width: {
                magnitude: maxHeightPoints, // Will be adjusted proportionally by Google Docs
                unit: "PT"
              }
            }
          }
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to insert image: ${response.status} - ${errorText}`);
  }
}

async function getGoogleAccessToken(credentials: any): Promise<string> {
  // Create JWT header
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  // Encode header and payload
  const encodedHeader = btoa(JSON.stringify(header)).replace(/[+/=]/g, (m) => ({'+':'-','/':'_','=':''}[m]));
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/[+/=]/g, (m) => ({'+':'-','/':'_','=':''}[m]));
  
  // Prepare private key
  let privateKey = credentials.private_key;
  
  if (!privateKey) {
    throw new Error('No private key found in service account credentials');
  }
  
  // Clean up the private key format
  privateKey = privateKey.replace(/\\n/g, '\n');
  privateKey = privateKey.trim();
  
  if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('Invalid private key format: missing BEGIN header');
  }
  
  if (!privateKey.endsWith('-----END PRIVATE KEY-----')) {
    throw new Error('Invalid private key format: missing END footer');
  }

  // Extract the base64 content between the headers
  const keyContent = privateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');

  let keyBytes;
  try {
    keyBytes = Uint8Array.from(atob(keyContent), c => c.charCodeAt(0));
  } catch (error) {
    throw new Error(`Failed to decode private key: ${error.message}`);
  }

  // Import the private key
  let cryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      keyBytes,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["sign"]
    );
  } catch (error) {
    throw new Error(`Failed to import private key: ${error.message}`);
  }

  // Sign the JWT
  const dataToSign = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  
  let signature;
  try {
    signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, dataToSign);
  } catch (error) {
    throw new Error(`Failed to sign JWT: ${error.message}`);
  }
  
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/[+/=]/g, (m) => ({'+':'-','/':'_','=':''}[m]));
  
  const jwt = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("Token exchange failed:", tokenResponse.status, errorText);
    throw new Error(`Failed to get access token: ${tokenResponse.statusText} - ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

function generateHeaderContent(artworks: Artwork[]): string {
  let content = "ARTWORK LIST\n\n";
  content += `Date: ${new Date().toLocaleDateString()}\n`;
  content += `Total Artworks: ${artworks.length}\n`;
  return content;
}

function generateArtworkContent(artwork: Artwork, index: number): string {
  let content = `${index}. `;
  
  // Artist name
  if (artwork.artist_name) {
    content += `${artwork.artist_name}\n`;
  } else {
    content += "Unknown Artist\n";
  }
  
  // Title and year
  const title = artwork.title || "Untitled";
  const year = artwork.year ? `, ${artwork.year}` : "";
  content += `${title}${year}\n`;
  
  // Medium and materials
  if (artwork.medium_type) {
    content += `${artwork.medium_type}`;
    if (artwork.materials) {
      content += `, ${artwork.materials}`;
    }
    content += "\n";
  } else if (artwork.materials) {
    content += `${artwork.materials}\n`;
  }
  
  // Dimensions
  if (artwork.dimensions) {
    content += `${artwork.dimensions}\n`;
  }
  
  // Price
  if (artwork.price) {
    content += `${artwork.currency} ${artwork.price.toLocaleString()}\n`;
  }
  
  // Status
  if (artwork.status) {
    content += `Status: ${artwork.status}\n`;
  }
  
  return content;
}

serve(handler);
