
import React from 'react';
import { CSVPreviewData, FieldMappings, ARTWORK_FIELDS_FOR_MAPPING, ArtworkKeys } from './ArtworkFieldMapping.types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FieldMappingStepProps {
  csvPreviewData: CSVPreviewData;
  mappings: FieldMappings;
  onMappingsChange: (newMappings: FieldMappings) => void;
  onNext: () => void;
  onBack: () => void;
}

export const FieldMappingStep: React.FC<FieldMappingStepProps> = ({
  csvPreviewData,
  mappings,
  onMappingsChange,
  onNext,
  onBack,
}) => {
  const { headers, sampleData } = csvPreviewData;

  const handleMappingChange = (csvHeader: string, artworkField: string) => {
    // Convert "do_not_import" back to null for the mappings
    const fieldValue = artworkField === "do_not_import" ? null : (artworkField as ArtworkKeys | null);
    onMappingsChange({
      ...mappings,
      [csvHeader]: fieldValue,
    });
  };

  // Attempt to auto-map based on header similarity (simple version)
  React.useEffect(() => {
    const initialMappings: FieldMappings = {};
    let changed = false;
    headers.forEach(header => {
      const headerLower = header.toLowerCase().replace(/[\s_]+/g, '');
      const autoMatch = ARTWORK_FIELDS_FOR_MAPPING.find(artworkField => {
        const fieldLower = artworkField.value.toLowerCase().replace(/[\s_]+/g, '');
        const labelLower = artworkField.label.toLowerCase().replace(/[\s_]+/g, '');
        return fieldLower === headerLower || labelLower === headerLower;
      });
      if (autoMatch && !mappings[header]) {
        initialMappings[header] = autoMatch.value;
        changed = true;
      } else {
        initialMappings[header] = mappings[header] || null;
      }
    });
    if (changed) {
      onMappingsChange(initialMappings);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]); // Run only when headers change, not onMappingsChange to avoid loop

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Map CSV Fields to Artwork Properties</h3>
        <p className="text-sm text-muted-foreground">
          Match columns from your CSV file to the corresponding artwork properties. Unmapped columns will be ignored.
        </p>
      </div>

      <ScrollArea className="h-[400px] border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">CSV Header</TableHead>
              <TableHead className="w-[30%]">Sample Data (First Row)</TableHead>
              <TableHead className="w-[40%]">Map to Artwork Property</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {headers.map((header) => (
              <TableRow key={header}>
                <TableCell className="font-medium">{header}</TableCell>
                <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {sampleData[0]?.[header] || <em>empty</em>}
                </TableCell>
                <TableCell>
                  <Select
                    value={mappings[header] || 'do_not_import'}
                    onValueChange={(value) => handleMappingChange(header, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Artwork Property" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="do_not_import">
                        <em>-- Do Not Import --</em>
                      </SelectItem>
                      {ARTWORK_FIELDS_FOR_MAPPING.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>
          Next (Preview & Import)
        </Button>
      </div>
    </div>
  );
};
