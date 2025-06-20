
const GOOGLE_DRIVE_API_URL = "https://www.googleapis.com/drive/v3/files";

export async function copyTemplateDocument(accessToken: string, templateId: string, title: string): Promise<string> {
  const copyDocResponse = await fetch(`${GOOGLE_DRIVE_API_URL}/${templateId}/copy`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: title
    })
  });

  if (!copyDocResponse.ok) {
    const errorText = await copyDocResponse.text();
    console.error("Failed to copy template document:", copyDocResponse.status, errorText);
    
    if (copyDocResponse.status === 403) {
      throw new Error("Google API access forbidden. Please ensure the Google Docs API and Drive API are enabled, and the service account has access to the template document.");
    }
    
    throw new Error(`Failed to copy template document: ${copyDocResponse.status} - ${errorText}`);
  }

  const docData = await copyDocResponse.json();
  return docData.id;
}

export async function makeDocumentPublic(accessToken: string, documentId: string): Promise<void> {
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
}
