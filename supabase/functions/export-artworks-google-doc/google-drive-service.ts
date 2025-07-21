
const GOOGLE_DRIVE_API_URL = "https://www.googleapis.com/drive/v3/files";

export async function checkStorageQuota(accessToken: string): Promise<{ available: boolean, usage?: any }> {
  try {
    const response = await fetch("https://www.googleapis.com/drive/v3/about?fields=storageQuota", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      const quota = data.storageQuota;
      const usedBytes = parseInt(quota.usage || "0");
      const limitBytes = parseInt(quota.limit || "0");
      
      console.log(`Storage usage: ${usedBytes} / ${limitBytes} bytes`);
      
      // Consider quota exceeded if usage is > 90% of limit
      const isQuotaExceeded = limitBytes > 0 && (usedBytes / limitBytes) > 0.9;
      
      return {
        available: !isQuotaExceeded,
        usage: {
          used: usedBytes,
          limit: limitBytes,
          percentUsed: limitBytes > 0 ? (usedBytes / limitBytes) * 100 : 0
        }
      };
    } else {
      console.warn("Could not check storage quota:", response.status);
      return { available: true }; // Assume available if we can't check
    }
  } catch (error) {
    console.warn("Storage quota check failed:", error);
    return { available: true }; // Assume available if check fails
  }
}

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
      // Check for storage quota exceeded error in the raw text first
      if (errorText.includes("storage quota") || errorText.includes("storageQuotaExceeded") || 
          errorText.includes("Drive storage") || errorText.includes("Storage quota")) {
        throw new Error("storage quota exceeded");
      }
      
      // Try parsing as JSON for more detailed error checking
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
        const errorMessage = errorDetails.error?.message || '';
        const errorReason = errorDetails.error?.errors?.[0]?.reason || '';
        
        if (errorMessage.includes("storage quota") || errorReason === "storageQuotaExceeded" || 
            errorMessage.includes("Drive storage")) {
          throw new Error("storage quota exceeded");
        }
      } catch (e) {
        // If JSON parsing fails, we already checked the raw text above
      }
      
      // Default 403 error
      throw new Error("Google API access forbidden. Please ensure the Google Docs API and Drive API are enabled, and the service account has access to the template document.");
    }
    
    if (copyDocResponse.status === 404) {
      throw new Error("Template document not found. Please verify the template document ID is correct and the service account has access to it.");
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

export async function cleanupOldDocuments(accessToken: string, maxDocuments: number = 50): Promise<number> {
  try {
    // Get list of documents created by this service account, ordered by creation date
    const listResponse = await fetch(
      `${GOOGLE_DRIVE_API_URL}?q=name contains 'Artwork List' or name contains 'Artwork Details'&orderBy=createdTime desc&pageSize=${maxDocuments + 10}&fields=files(id,name,createdTime)`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!listResponse.ok) {
      console.warn("Could not list documents for cleanup:", listResponse.status);
      return 0;
    }

    const data = await listResponse.json();
    const files = data.files || [];
    
    // If we have more than maxDocuments, delete the oldest ones
    if (files.length > maxDocuments) {
      const filesToDelete = files.slice(maxDocuments);
      let deletedCount = 0;
      
      for (const file of filesToDelete) {
        try {
          const deleteResponse = await fetch(`${GOOGLE_DRIVE_API_URL}/${file.id}`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
            },
          });
          
          if (deleteResponse.ok) {
            deletedCount++;
            console.log(`Deleted old document: ${file.name} (${file.id})`);
          } else {
            console.warn(`Failed to delete document ${file.name}: ${deleteResponse.status}`);
          }
        } catch (error) {
          console.warn(`Error deleting document ${file.name}:`, error);
        }
      }
      
      return deletedCount;
    }
    
    return 0;
  } catch (error) {
    console.warn("Cleanup operation failed:", error);
    return 0;
  }
}
