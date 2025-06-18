
import React from "react";

interface MapContainerProps {
  containerRef: React.RefObject<HTMLDivElement>;
  children?: React.ReactNode;
}

export function MapContainer({ containerRef, children }: MapContainerProps) {
  return (
    <div className="relative w-full h-64 rounded border overflow-hidden">
      <div 
        ref={containerRef} 
        className="absolute inset-0"
        style={{ minHeight: '256px', minWidth: '100%' }}
      />
      {children}
    </div>
  );
}
