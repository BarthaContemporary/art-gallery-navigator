
const GOOGLE_API_URL = "https://docs.googleapis.com/v1/documents";

export async function insertTextAtIndex(documentId: string, accessToken: string, index: number, text: string) {
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

export async function insertImageAtIndex(documentId: string, accessToken: string, index: number, imageUrl: string) {
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
