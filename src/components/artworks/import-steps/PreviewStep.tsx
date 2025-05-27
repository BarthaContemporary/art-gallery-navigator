
import React from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListChecks, StepBack } from "lucide-react";
import { PreviewStepProps } from './types';

export const PreviewStep: React.FC<PreviewStepProps> = ({ parsedArtworks, onImport, onBack }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Preview Import</h3>
      <p className="text-sm text-muted-foreground">
        Found {parsedArtworks.length} artworks to import based on your mappings.
        Review the first few entries below.
      </p>
      {parsedArtworks.length > 0 ? (
        <ScrollArea className="h-64 border rounded-md p-4">
          <ul className="space-y-3">
            {parsedArtworks.slice(0, 10).map((artwork, index) => (
              <li key={index} className="text-sm border-b pb-2">
                <p><span className="font-medium">Title:</span> {artwork.title || "N/A"}</p>
                {artwork.artist_id && <p><span className="font-medium">Artist ID:</span> {artwork.artist_id}</p>}
                {artwork.year && <p><span className="font-medium">Year:</span> {artwork.year}</p>}
                {artwork.medium_type && <p><span className="font-medium">Medium:</span> {artwork.medium_type}</p>}
                {artwork.price && <p><span className="font-medium">Price:</span> {artwork.price} {artwork.currency}</p>}
              </li>
            ))}
          </ul>
        </ScrollArea>
      ) : (
        <p className="text-orange-600">No artworks could be generated. Please go back and check your field mappings.</p>
      )}
      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" onClick={onBack}><StepBack className="mr-2 h-4 w-4"/>Back to Mapping</Button>
        <Button onClick={onImport} disabled={parsedArtworks.length === 0}>
          <ListChecks className="mr-2 h-4 w-4"/>Import {parsedArtworks.length} Artworks
        </Button>
      </div>
    </div>
  );
};
