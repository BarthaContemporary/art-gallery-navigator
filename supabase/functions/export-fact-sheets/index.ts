
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const GOOGLE_SHEETS_API_URL = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_DRIVE_API_URL = "https://www.googleapis.com/drive/v3/files";

interface Client {
  full_name: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  status?: string;
  client_type?: string;
  interested_artists?: string[];
  notes?: string;
  birthday?: string;
  tags?: string[];
  last_activity_date?: string;
  source?: string;
  website?: string;
  instagram_handle?: string;
  linkedin_handle?: string;
}

interface RequestBody {
  clients: Client[];
  listId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clients, listId }: RequestBody = await req.json();
    
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
    
    // Create a new Google Sheet
    const sheetTitle = `Client Fact Sheets - ${listId ? `List ${listId}` : 'All Clients'} - ${new Date().toLocaleDateString()}`;
    console.log("Creating Google Sheet with title:", sheetTitle);
    
    const createSheetResponse = await fetch(GOOGLE_SHEETS_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          title: sheetTitle
        }
      })
    });

    console.log("Create spreadsheet response status:", createSheetResponse.status);

    if (!createSheetResponse.ok) {
      const errorText = await createSheetResponse.text();
      console.error("Failed to create spreadsheet:", createSheetResponse.status, errorText);
      
      if (createSheetResponse.status === 403) {
        return new Response(
          JSON.stringify({ 
            error: "Google API access forbidden. Please ensure the Google Sheets API is enabled in your Google Cloud Console and the service account has the necessary permissions." 
          }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      throw new Error(`Failed to create spreadsheet: ${createSheetResponse.status} - ${errorText}`);
    }

    const sheetData = await createSheetResponse.json();
    const spreadsheetId = sheetData.spreadsheetId;
    console.log("Spreadsheet created with ID:", spreadsheetId);

    // Prepare data for the sheet
    const headers = [
      "Name", "Email", "Phone", "Company", "Address", "Status", "Client Type", 
      "Interested Artists", "Notes", "Birthday", "Tags", "Last Activity", 
      "Source", "Website", "Instagram", "LinkedIn"
    ];

    const rows = clients.map(client => [
      client.full_name || "",
      client.email || "",
      client.phone || "",
      client.company || "",
      client.address || "",
      client.status || "",
      client.client_type || "",
      client.interested_artists ? client.interested_artists.join(", ") : "",
      client.notes || "",
      client.birthday || "",
      client.tags ? client.tags.join(", ") : "",
      client.last_activity_date ? new Date(client.last_activity_date).toLocaleDateString() : "",
      client.source || "",
      client.website || "",
      client.instagram_handle || "",
      client.linkedin_handle || ""
    ]);

    const allData = [headers, ...rows];

    // Update the sheet with data
    console.log("Inserting data into spreadsheet...");
    const updateResponse = await fetch(`${GOOGLE_SHEETS_API_URL}/${spreadsheetId}/values/A1:update?valueInputOption=RAW`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: allData
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error("Failed to update spreadsheet:", updateResponse.status, errorText);
      throw new Error(`Failed to update spreadsheet: ${updateResponse.status} - ${errorText}`);
    }

    console.log("Spreadsheet data updated successfully");

    // Format the header row
    console.log("Formatting spreadsheet...");
    await fetch(`${GOOGLE_SHEETS_API_URL}/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: headers.length
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                  textFormat: { bold: true }
                }
              },
              fields: "userEnteredFormat(backgroundColor,textFormat)"
            }
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: "COLUMNS",
                startIndex: 0,
                endIndex: headers.length
              }
            }
          }
        ]
      })
    });

    // Make the spreadsheet publicly viewable
    console.log("Making spreadsheet publicly viewable...");
    const permissionResponse = await fetch(`${GOOGLE_DRIVE_API_URL}/${spreadsheetId}/permissions`, {
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
      console.warn("Failed to make spreadsheet public (proceeding anyway):", permissionResponse.status, errorText);
    } else {
      console.log("Spreadsheet made publicly viewable");
    }

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    console.log("Spreadsheet URL:", spreadsheetUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        spreadsheetUrl,
        spreadsheetId,
        clientCount: clients.length
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error("Error creating fact sheets:", error);
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
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive",
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

serve(handler);
