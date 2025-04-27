
import React from "react";

interface ArtworkTemplatePreviewProps {
  useStationery: boolean;
  template: string;
  title: string;
}

export function ArtworkTemplatePreview({ 
  useStationery, 
  template,
  title 
}: ArtworkTemplatePreviewProps) {
  return (
    <div className="h-full overflow-auto font-sans">
      {/* Preview content with proper top padding */}
      <div style={{ paddingTop: '2.5rem' }}>
        {/* Preview header based on template */}
        {template === "classic" && (
          <div className="border-b-2 border-primary pb-4 mb-6">
            <h2 className="text-3xl font-bold text-primary">{title}</h2>
          </div>
        )}
        
        {template === "modern" && (
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-light">{title}</h2>
            <div className="w-24 h-1 bg-primary"></div>
          </div>
        )}
        
        {template === "minimal" && (
          <h2 className="text-2xl uppercase tracking-widest mb-8">{title}</h2>
        )}
        
        {/* Artwork image placeholder */}
        <div className="mb-6 text-center">
          <div className="w-full h-48 bg-gray-100 border flex items-center justify-center mb-4">
            <span className="text-gray-400">Artwork Image</span>
          </div>
        </div>
        
        {/* Artwork details preview */}
        <div className={template === "modern" ? "pl-4 border-l-4 border-primary" : ""}>
          <p className="font-bold mb-1">Artist Name</p>
          <p className="italic mb-4">{title}, 2023</p>
          <p className="mb-2">Oil on canvas</p>
          <p className="mb-2">Edition of 10 + 2 AP</p>
          <p className="mb-2">120 x 80 cm</p>
          <p className="mb-2">47 1/4 x 31 1/2"</p>
          
          {/* Additional info based on template */}
          {template === "basicWithPrice" && (
            <p className="font-semibold mt-6">£ 5,000</p>
          )}
          
          {template === "minimal" && (
            <>
              <p className="font-semibold mt-6">£ 5,000</p>
              
              <div className="mt-8">
                <h3 className="font-semibold text-lg mb-2">Story</h3>
                <p className="text-sm">Sample story text about the artwork and its creation.</p>
              </div>
              
              <div className="mt-6">
                <h3 className="font-semibold text-lg mb-2">Provenance</h3>
                <p className="text-sm">Gallery collection, London</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
