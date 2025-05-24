
import React from "react";

interface ArtworkTemplatePreviewProps {
  // useStationery is now always true implicitly
  // template is no longer needed
  title: string; // This likely represents artwork title for the preview
}

export function ArtworkTemplatePreview({ 
  title 
}: ArtworkTemplatePreviewProps) {
  // Dummy data for preview structure
  const artistName = "Artist Name"; // Placeholder
  const artworkTitle = title || "Artwork Title";
  const year = "2023"; // Placeholder
  const materials = "Oil on canvas"; // Placeholder
  const editionInfo = "Edition of 10 + 2 AP"; // Placeholder
  const dimensionsCm = "120 x 80 cm"; // Placeholder
  const dimensionsIn = "47 1/4 x 31 1/2\""; // Placeholder
  const mediumType = "Painting"; // Placeholder

  return (
    <div className="h-full overflow-auto font-sans relative">
      {/* Stationery implies content is already pushed down by parent styling (padding on content-wrapper) */}
      {/* The parent div in PDFPreviewDocument handles the overall paper size and stationery background */}
      
      <div className="py-2 px-2"> {/* Minimal padding within the content area itself */}
        {/* Artist Name Header */}
        <div className="mb-4 text-left">
          <h2 className="text-xl font-bold">{artistName}</h2>
        </div>
        
        {/* Artwork image placeholder */}
        <div className="mb-6 text-center">
          <div className="w-full h-64 bg-gray-100 border flex items-center justify-center mb-4">
            <span className="text-gray-400">Artwork Image</span>
          </div>
          
          {/* Details Below Image */}
          <div className="text-left text-sm space-y-1">
            <p><strong>{artworkTitle}{year ? `, ${year}` : ''}</strong></p>
            <p>{materials}</p>
            <p>{editionInfo}</p>
            <p>{dimensionsCm}</p>
            <p>{dimensionsIn}</p>
            <p>{mediumType}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
