
import React from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListChecks, StepBack, AlertTriangle, Info } from "lucide-react"; // Added AlertTriangle, Info
import { PreviewStepProps } from './types'; // Uses ValidatedProcessedArtwork[] via PreviewStepProps
import { Badge } from '@/components/ui/badge'; // For displaying warning/error counts

export const PreviewStep: React.FC<PreviewStepProps> = ({ parsedArtworks, onImport, onBack }) => {
  const validArtworksCount = parsedArtworks.filter(item => item.isValid).length;
  const artworksWithWarnings = parsedArtworks.filter(item => item.warnings.length > 0 && item.isValid).length;
  // Assuming errors make an artwork !isValid. If errors can exist on isValid=true items, adjust logic.
  // For now, our parser makes isValid=true if errors array is empty.

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Preview Import</h3>
      <p className="text-sm text-muted-foreground">
        Found {parsedArtworks.length} artworks after parsing. {validArtworksCount} appear ready for import.
        {artworksWithWarnings > 0 && (
          <span className="ml-2 text-yellow-600">({artworksWithWarnings} with warnings)</span>
        )}
        Review the entries and validation messages below.
      </p>
      {parsedArtworks.length > 0 ? (
        <ScrollArea className="h-72 border rounded-md p-4">
          <ul className="space-y-4">
            {parsedArtworks.slice(0, 20).map((validatedArtwork, index) => ( // Show more items for preview
              <li key={index} className="text-sm border-b pb-3">
                <p className="font-semibold">Row {validatedArtwork.originalRowIndex} in CSV:</p>
                <p><span className="font-medium">Title:</span> {validatedArtwork.artwork.title || "N/A"}</p>
                {validatedArtwork.artwork.artist_name && <p><span className="font-medium">Artist Name:</span> {validatedArtwork.artwork.artist_name}</p>}
                {validatedArtwork.artwork.artist_id && <p><span className="font-medium">Artist ID:</span> {validatedArtwork.artwork.artist_id}</p>}
                {validatedArtwork.artwork.year && <p><span className="font-medium">Year:</span> {validatedArtwork.artwork.year}</p>}
                {validatedArtwork.artwork.medium_type && <p><span className="font-medium">Medium:</span> {validatedArtwork.artwork.medium_type}</p>}
                {validatedArtwork.artwork.price && <p><span className="font-medium">Price:</span> {validatedArtwork.artwork.price} {validatedArtwork.artwork.currency}</p>}
                
                {validatedArtwork.warnings.length > 0 && (
                  <div className="mt-1.5 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-xs font-medium text-yellow-700 flex items-center">
                      <Info className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                      Warnings:
                    </p>
                    <ul className="list-disc list-inside pl-1 text-xs text-yellow-600 mt-0.5">
                      {validatedArtwork.warnings.map((warn, i) => <li key={i}>{warn}</li>)}
                    </ul>
                  </div>
                )}
                {/* Currently, our parser doesn't generate errors that make isValid false client-side yet. This is for future */}
                {validatedArtwork.errors.length > 0 && (
                  <div className="mt-1.5 p-2 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-xs font-medium text-red-700 flex items-center">
                      <AlertTriangle className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                      Errors (will prevent import of this item):
                    </p>
                    <ul className="list-disc list-inside pl-1 text-xs text-red-600 mt-0.5">
                      {validatedArtwork.errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {parsedArtworks.length > 20 && (
            <p className="text-center text-xs text-muted-foreground mt-3">Showing first 20 records for preview.</p>
          )}
        </ScrollArea>
      ) : (
        <p className="text-orange-600">No artworks could be generated. Please go back and check your field mappings or CSV file content.</p>
      )}
      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" onClick={onBack}><StepBack className="mr-2 h-4 w-4"/>Back to Mapping</Button>
        <Button onClick={onImport} disabled={validArtworksCount === 0}>
          <ListChecks className="mr-2 h-4 w-4"/>
          Import {validArtworksCount} Artworks
        </Button>
      </div>
    </div>
  );
};
