import React, { useState } from 'react';
import { FieldMappings, CSVPreviewData, ARTWORK_FIELDS_FOR_MAPPING, ArtworkKeys } from "./ArtworkFieldMapping.types";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FieldMappingStepProps } from './import-steps/types';

export const FieldMappingStep: React.FC<FieldMappingStepProps> = ({
  csvData,
  fieldMapping,
  onFieldMappingChange,
  onNext,
  onBack,
}) => {
  const { headers, sampleData } = csvData;
  const [isAIMapping, setIsAIMapping] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const { toast } = useToast();

  const handleMappingChange = (csvHeader: string, artworkField: string) => {
    // Convert "do_not_import" back to null for the mappings
    const fieldValue = artworkField === "do_not_import" ? null : (artworkField as ArtworkKeys | null);
    onFieldMappingChange({
      ...fieldMapping,
      [csvHeader]: fieldValue,
    });
  };

  const handleAIMapping = async () => {
    setIsAIMapping(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-field-mapper', {
        body: {
          headers: csvData.headers,
          sampleData: csvData.sampleData
        }
      });

      if (error) throw error;

      setAiSuggestions(data.mappings || []);
      setShowAISuggestions(true);
      
      toast({
        title: "AI Mapping Complete",
        description: `Found ${data.mappings?.length || 0} field mapping suggestions`,
      });
    } catch (error) {
      console.error('AI mapping error:', error);
      toast({
        title: "AI Mapping Error",
        description: "Failed to get AI field mapping suggestions. Please map fields manually.",
        variant: "destructive",
      });
    } finally {
      setIsAIMapping(false);
    }
  };

  const applyAISuggestion = (suggestion: any) => {
    if (suggestion.suggestedField) {
      const newMapping = { ...fieldMapping };
      newMapping[suggestion.csvHeader] = suggestion.suggestedField;
      onFieldMappingChange(newMapping);
      
      toast({
        title: "Mapping Applied",
        description: `Mapped "${suggestion.csvHeader}" to "${suggestion.suggestedField}"`,
      });
    }
  };

  const applyAllAISuggestions = () => {
    const newMapping = { ...fieldMapping };
    let appliedCount = 0;
    
    aiSuggestions.forEach(suggestion => {
      if (suggestion.suggestedField && suggestion.confidence > 0.7) {
        newMapping[suggestion.csvHeader] = suggestion.suggestedField;
        appliedCount++;
      }
    });
    
    onFieldMappingChange(newMapping);
    setShowAISuggestions(false);
    
    toast({
      title: "AI Suggestions Applied",
      description: `Applied ${appliedCount} high-confidence field mappings`,
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
      if (autoMatch && !fieldMapping[header]) {
        initialMappings[header] = autoMatch.value;
        changed = true;
      } else {
        initialMappings[header] = fieldMapping[header] || null;
      }
    });
    if (changed) {
      onFieldMappingChange(initialMappings);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]); // Run only when headers change, not onFieldMappingChange to avoid loop

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Map CSV Fields to Artwork Properties</h3>
            <p className="text-sm text-muted-foreground">
              Match columns from your CSV file to the corresponding artwork properties. Required fields are marked with an asterisk (*).
            </p>
          </div>
          <Button
            onClick={handleAIMapping}
            disabled={isAIMapping}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {isAIMapping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isAIMapping ? "AI Mapping..." : "Auto-Map with AI"}
          </Button>
        </div>

        {showAISuggestions && aiSuggestions.length > 0 && (
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Mapping Suggestions
              </h3>
              <div className="flex gap-2">
                <Button
                  onClick={applyAllAISuggestions}
                  size="sm"
                  variant="default"
                >
                  Apply All High Confidence
                </Button>
                <Button
                  onClick={() => setShowAISuggestions(false)}
                  size="sm"
                  variant="ghost"
                >
                  Dismiss
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              {aiSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{suggestion.csvHeader}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-sm font-medium text-primary">
                        {suggestion.suggestedField || "No mapping"}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        suggestion.confidence > 0.8 ? 'bg-green-100 text-green-800' :
                        suggestion.confidence > 0.6 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {Math.round(suggestion.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {suggestion.reasoning}
                    </p>
                  </div>
                  {suggestion.suggestedField && (
                    <Button
                      onClick={() => applyAISuggestion(suggestion)}
                      size="sm"
                      variant="outline"
                    >
                      Apply
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
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
                    value={fieldMapping[header] || 'do_not_import'}
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

      <div className="flex justify-between">
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext}>
          Next
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};