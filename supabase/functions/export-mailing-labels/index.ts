import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const GOOGLE_API_URL = "https://docs.googleapis.com/v1/documents";
const GOOGLE_DRIVE_API_URL = "https://www.googleapis.com/drive/v3/files";

interface Client {
  full_name: string;
  address: string;
  email?: string;
  phone?: string;
}

interface RequestBody {
  clients: Client[];
  listId?: string;
  labelFormat: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clients, listId, labelFormat }: RequestBody = await req.json();
    
    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ error: "No clients provided" }),
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
      console.log("Service account email:", credentials.client_email);
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
    
    // Create a new Google Doc
    const docTitle = `Mailing Labels - ${listId ? `List ${listId}` : 'All Clients'} - ${new Date().toLocaleDateString()}`;
    console.log("Creating Google Doc with title:", docTitle);
    
    const createDocResponse = await fetch(GOOGLE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: docTitle
      })
    });

    console.log("Create document response status:", createDocResponse.status);
    
    if (!createDocResponse.ok) {
      const errorText = await createDocResponse.text();
      console.error("Failed to create document:", createDocResponse.status, errorText);
      
      if (createDocResponse.status === 403) {
        return new Response(
          JSON.stringify({ 
            error: "Google API access forbidden. Please ensure the Google Docs API is enabled in your Google Cloud Console and the service account has the necessary permissions." 
          }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      throw new Error(`Failed to create document: ${createDocResponse.status} - ${errorText}`);
    }

    const docData = await createDocResponse.json();
    const documentId = docData.documentId;
    console.log("Document created with ID:", documentId);

    // Generate label content for Avery L7165 (A4, 8 labels: 2 columns × 4 rows)
    const labelContent = generateAveryL7165Content(clients);

    // Insert content into the document
    console.log("Inserting content into document...");
    const batchUpdateResponse = await fetch(`${GOOGLE_API_URL}/${documentId}:batchUpdate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: labelContent
            }
          }
        ]
      })
    });

    if (!batchUpdateResponse.ok) {
      const errorText = await batchUpdateResponse.text();
      console.error("Failed to update document:", batchUpdateResponse.status, errorText);
      throw new Error(`Failed to update document: ${batchUpdateResponse.status} - ${errorText}`);
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
        clientCount: clients.length
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error("Error creating mailing labels:", error);
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
  
  // Remove any extra whitespace or formatting issues
  privateKey = privateKey.trim();
  
  // Ensure proper PEM format
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

function generateAveryL7165Content(clients: Client[]): string {
  // Avery L7165: A4 sheet, 8 labels (2 columns × 4 rows)
  // Each label: 99.06 × 67.73 mm
  
  let content = "";
  
  // Process clients in groups of 8 (one sheet)
  for (let sheet = 0; sheet < Math.ceil(clients.length / 8); sheet++) {
    const sheetClients = clients.slice(sheet * 8, (sheet + 1) * 8);
    
    // Add page break between sheets (except for first sheet)
    if (sheet > 0) {
      content += "\n\n--- NEW SHEET ---\n\n";
    }
    
    // Process labels in pairs (left column, right column)
    for (let row = 0; row < 4; row++) {
      const leftIndex = row * 2;
      const rightIndex = row * 2 + 1;
      
      const leftClient = sheetClients[leftIndex];
      const rightClient = sheetClients[rightIndex];
      
      let rowContent = "";
      
      // Left column label
      if (leftClient) {
        rowContent += formatClientAddress(leftClient);
      }
      
      // Add spacing between columns
      rowContent += "\t\t\t";
      
      // Right column label
      if (rightClient) {
        rowContent += formatClientAddress(rightClient);
      }
      
      content += rowContent + "\n\n";
    }
  }
  
  return content;
}

function formatClientAddress(client: Client): string {
  let address = client.full_name;
  if (client.address) {
    // Split address by commas and add each part on a new line
    const addressParts = client.address.split(',').map(part => part.trim());
    address += "\n" + addressParts.join("\n");
  }
  return address;
}

serve(handler);
