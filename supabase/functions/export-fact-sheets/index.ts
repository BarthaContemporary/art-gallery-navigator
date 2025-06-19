
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
      return new Response(
        JSON.stringify({ error: "Google API credentials not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const credentials = JSON.parse(googleCredentials);
    
    // Get access token
    const accessToken = await getGoogleAccessToken(credentials);
    
    // Create a new Google Sheet
    const sheetTitle = `Client Fact Sheets - ${listId ? `List ${listId}` : 'All Clients'} - ${new Date().toLocaleDateString()}`;
    
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

    if (!createSheetResponse.ok) {
      throw new Error(`Failed to create spreadsheet: ${createSheetResponse.statusText}`);
    }

    const sheetData = await createSheetResponse.json();
    const spreadsheetId = sheetData.spreadsheetId;

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
      throw new Error(`Failed to update spreadsheet: ${updateResponse.statusText}`);
    }

    // Format the header row
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
    await fetch(`${GOOGLE_DRIVE_API_URL}/${spreadsheetId}/permissions`, {
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

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

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
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  // Import the key for signing (simplified version for demo)
  // In a real implementation, you'd need proper JWT signing
  const keyData = credentials.private_key.replace(/\\n/g, '\n');
  
  // For now, we'll throw an error to indicate this needs proper implementation
  throw new Error("JWT signing not implemented. Please configure Google service account properly.");
}

serve(handler);
