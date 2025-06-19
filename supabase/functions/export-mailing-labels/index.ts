
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
      return new Response(
        JSON.stringify({ error: "Google API credentials not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const credentials = JSON.parse(googleCredentials);
    
    // Get access token
    const accessToken = await getGoogleAccessToken(credentials);
    
    // Create a new Google Doc
    const docTitle = `Mailing Labels - ${listId ? `List ${listId}` : 'All Clients'} - ${new Date().toLocaleDateString()}`;
    
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

    if (!createDocResponse.ok) {
      throw new Error(`Failed to create document: ${createDocResponse.statusText}`);
    }

    const docData = await createDocResponse.json();
    const documentId = docData.documentId;

    // Generate label content for Avery L7165 (A4, 8 labels: 2 columns × 4 rows)
    const labelContent = generateAveryL7165Content(clients);

    // Insert content into the document
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
      throw new Error(`Failed to update document: ${batchUpdateResponse.statusText}`);
    }

    // Make the document publicly viewable
    await fetch(`${GOOGLE_DRIVE_API_URL}/${documentId}/permissions`, {
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

    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;

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
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
};

async function getGoogleAccessToken(credentials: any): Promise<string> {
  const jwtHeader = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  // Import the key for signing
  const keyData = credentials.private_key.replace(/\\n/g, '\n');
  const key = await crypto.subtle.importKey(
    "pkcs8",
    new TextEncoder().encode(keyData),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  // Create JWT
  const encodedHeader = btoa(JSON.stringify(jwtHeader)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(jwtPayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const signatureData = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, signatureData);
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
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
    throw new Error(`Failed to get access token: ${tokenResponse.statusText}`);
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
