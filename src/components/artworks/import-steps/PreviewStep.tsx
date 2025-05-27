
import React, { useMemo } from 'react'; // Added useMemo
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListChecks, StepBack, AlertTriangle, Info } from "lucide-react";
import { PreviewStepProps } from './types';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export const PreviewStep: React.FC<PreviewStepProps> = ({ parsedArtworks, onImport, onBack, toggleArtworkSelection, toggleSelectAllArtworks }) => {
  
  const selectedValidArtworksCount = useMemo(() => {
    return parsedArtworks.filter(item => item.isValid && item.isSelectedForImport).length;
  }, [parsedArtworks]);

  const totalValidArtworks = useMemo(() => {
    return parsedArtworks.filter(item => item.isValid).length;
  }, [parsedArtworks]);

  const totalInvalidArtworks = useMemo(() => {
    return parsedArtworks.filter(item => !item.isValid).length;
  }, [parsedArtworks]);

  const totalValidWithWarnings = useMemo(() => {
    return parsedArtworks.filter(item => item.isValid && item.warnings.length > 0).length;
  }, [parsedArtworks]);

  const allValidSelected = useMemo(() => {
    return totalValidArtworks > 0 && selectedValidArtworksCount === totalValidArtworks;
  }, [totalValidArtworks, selectedValidArtworksCount]);

  const someValidSelected = useMemo(() => {
    return selectedValidArtworksCount > 0 && selectedValidArtworksCount < totalValidArtworks;
  }, [selectedValidArtworksCount, totalValidArtworks]);

  const handleSelectAllChange = (checked: boolean | 'indeterminate') => {
    if (typeof checked === 'boolean') {
      toggleSelectAllArtworks(checked);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Preview Import</h3>
      <div className="text-sm text-muted-foreground space-y-1">
        <p>
          Processed <span className="font-semibold">{parsedArtworks.length}</span> row{parsedArtworks.length === 1 ? '' : 's'} from your CSV.
        </p>
        {parsedArtworks.length > 0 && (
          <>
            <p>
              <span className="font-semibold">{totalValidArtworks}</span> item{totalValidArtworks === 1 ? '' : 's'} are valid for import
              {totalValidWithWarnings > 0 && (
                <span className="text-yellow-600"> ({totalValidWithWarnings} with warnings)</span>
              )}.
            </p>
            {totalInvalidArtworks > 0 && (
              <p>
                <span className="font-semibold text-destructive">{totalInvalidArtworks}</span> item{totalInvalidArtworks === 1 ? '' : 's'} cannot be imported due to errors.
              </p>
            )}
          </>
        )}
        <p className="pt-1">Review the entries, select items for import, and check validation messages below.</p>
      </div>

      {parsedArtworks.length > 0 && (
        <div className="flex items-center space-x-2 mb-2 pl-1 pt-2">
          <Checkbox
            id="select-all-artworks"
            checked={allValidSelected ? true : (someValidSelected ? 'indeterminate' : false)}
            onCheckedChange={handleSelectAllChange}
            disabled={totalValidArtworks === 0}
          />
          <Label htmlFor="select-all-artworks" className="text-sm font-medium">
            {selectedValidArtworksCount} / {totalValidArtworks} valid artworks selected
          </Label>
        </div>
      )}

      {parsedArtworks.length > 0 ? (
        <ScrollArea className="h-72 border rounded-md p-4">
          <ul className="space-y-4">
            {parsedArtworks.slice(0, 100).map((validatedArtwork) => (
              <li key={validatedArtwork.originalRowIndex} className={`text-sm border-b pb-3 last:border-b-0 ${!validatedArtwork.isValid ? 'opacity-60 bg-slate-50 p-2 rounded-md' : ''} ${!validatedArtwork.isSelectedForImport && validatedArtwork.isValid ? 'opacity-70' : ''}`}>
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id={`select-artwork-${validatedArtwork.originalRowIndex}`}
                    checked={validatedArtwork.isSelectedForImport}
                    onCheckedChange={() => toggleArtworkSelection(validatedArtwork.originalRowIndex)}
                    disabled={!validatedArtwork.isValid}
                    className="mt-1 flex-shrink-0"
                  />
                  <div className="flex-grow">
                    <p className="font-semibold">Row {validatedArtwork.originalRowIndex} in CSV:</p>
                    {!validatedArtwork.isValid && (
                       <Badge variant="destructive" className="mb-1">Invalid for Import</Badge>
                    )}
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
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {parsedArtworks.length > 100 && (
            <p className="text-center text-xs text-muted-foreground mt-3">Showing first 100 records for preview.</p>
          )}
        </ScrollArea>
      ) : (
        <p className="text-orange-600">No artworks could be generated. Please go back and check your field mappings or CSV file content.</p>
      )}
      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" onClick={onBack}><StepBack className="mr-2 h-4 w-4"/>Back to Mapping</Button>
        <Button onClick={onImport} disabled={selectedValidArtworksCount === 0}>
          <ListChecks className="mr-2 h-4 w-4"/>
          Import {selectedValidArtworksCount} Selected Artworks
        </Button>
      </div>
    </div>
  );
};
