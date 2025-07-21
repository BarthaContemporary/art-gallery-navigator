
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Sparkles, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ValidatedProcessedArtwork, FieldMappings } from "@/components/artworks/ArtworkFieldMapping.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AIDataCleaningStepProps {
  parsedArtworks: ValidatedProcessedArtwork[];
  fieldMappings: FieldMappings;
  onCleaningComplete: (cleanedArtworks: ValidatedProcessedArtwork[]) => void;
  onBack: () => void;
  onNext: () => void;
}

interface CleaningSuggestion {
  originalRowIndex: number;
  suggestedChanges: Record<string, {
    original: string;
    suggested: string;
    reason: string;
  }>;
  qualityScore: number;
  warnings: string[];
}

interface AICleaningResponse {
  cleanedArtworks: CleaningSuggestion[];
  globalSuggestions: string[];
}

export const AIDataCleaningStep: React.FC<AIDataCleaningStepProps> = ({
  parsedArtworks,
  fieldMappings,
  onCleaningComplete,
  onBack,
  onNext,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [cleaningSuggestions, setCleaningSuggestions] = useState<CleaningSuggestion[]>([]);
  const [globalSuggestions, setGlobalSuggestions] = useState<string[]>([]);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [processedArtworks, setProcessedArtworks] = useState<ValidatedProcessedArtwork[]>([]);

  const handleAIDataCleaning = async () => {
    if (parsedArtworks.length === 0) {
      toast.error("No artworks to clean. Please go back and check your data.");
      return;
    }

    setIsProcessing(true);
    
    try {
      console.log('Starting AI data cleaning for', parsedArtworks.length, 'artworks');
      
      const { data, error } = await supabase.functions.invoke('ai-data-cleaner', {
        body: {
          artworks: parsedArtworks.map(va => va.artwork),
          fieldMappings
        }
      });

      if (error) {
        console.error('AI data cleaning error:', error);
        throw new Error(`AI cleaning failed: ${error.message || 'Unknown error'}`);
      }

      console.log('AI data cleaning response:', data);

      const cleaningResult = data as AICleaningResponse;
      setCleaningSuggestions(cleaningResult.cleanedArtworks || []);
      setGlobalSuggestions(cleaningResult.globalSuggestions || []);
      setHasProcessed(true);
      
      toast.success(`AI data cleaning complete! Found ${cleaningResult.cleanedArtworks?.length || 0} suggestions.`);
      
    } catch (error: any) {
      console.error('Error during AI data cleaning:', error);
      toast.error(`AI data cleaning failed: ${error.message}. You can skip this step and proceed to preview.`);
      
      // Allow users to continue without AI cleaning
      setHasProcessed(true);
      setProcessedArtworks(parsedArtworks);
    } finally {
      setIsProcessing(false);
    }
  };

  const applySuggestions = () => {
    if (cleaningSuggestions.length === 0) {
      // No suggestions, just pass through original artworks
      setProcessedArtworks(parsedArtworks);
      onCleaningComplete(parsedArtworks);
      return;
    }

    const cleanedArtworks = parsedArtworks.map(originalArtwork => {
      const suggestion = cleaningSuggestions.find(
        s => s.originalRowIndex === originalArtwork.originalRowIndex
      );

      if (!suggestion) {
        return originalArtwork;
      }

      // Apply suggested changes
      const updatedArtwork = { ...originalArtwork.artwork };
      Object.entries(suggestion.suggestedChanges).forEach(([field, change]) => {
        if (updatedArtwork.hasOwnProperty(field)) {
          (updatedArtwork as any)[field] = change.suggested;
        }
      });

      return {
        ...originalArtwork,
        artwork: updatedArtwork,
        warnings: [...originalArtwork.warnings, ...suggestion.warnings]
      };
    });

    console.log('Applied AI cleaning suggestions to', cleanedArtworks.length, 'artworks');
    setProcessedArtworks(cleanedArtworks);
    onCleaningComplete(cleanedArtworks);
    toast.success("AI suggestions applied successfully!");
  };

  const skipAICleaning = () => {
    console.log('Skipping AI data cleaning');
    setProcessedArtworks(parsedArtworks);
    setHasProcessed(true);
    onCleaningComplete(parsedArtworks);
    toast.info("AI data cleaning skipped. Proceeding with original data.");
  };

  useEffect(() => {
    // If we have processed artworks, we're ready to move on
    if (processedArtworks.length > 0) {
      // Automatically proceed to next step after a short delay
      const timer = setTimeout(() => {
        onNext();
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [processedArtworks, onNext]);

  const validArtworksCount = parsedArtworks.filter(va => va.isValid).length;
  const totalArtworksCount = parsedArtworks.length;

  return (
    <div className="space-y-6 py-4">
      <div className="text-center space-y-4">
        <h3 className="text-lg font-medium">AI Data Cleaning & Enhancement</h3>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          Our AI will analyze your artwork data to standardize formats, fix common issues, and enhance data quality. 
          This step is optional but recommended for better results.
        </p>
        
        <div className="flex items-center justify-center gap-4 text-sm">
          <Badge variant="outline" className="gap-2">
            <CheckCircle className="h-3 w-3 text-green-500" />
            {validArtworksCount} Valid Artworks
          </Badge>
          {totalArtworksCount - validArtworksCount > 0 && (
            <Badge variant="outline" className="gap-2">
              <AlertCircle className="h-3 w-3 text-yellow-500" />
              {totalArtworksCount - validArtworksCount} Need Attention
            </Badge>
          )}
        </div>
      </div>

      {!hasProcessed && (
        <div className="flex justify-center gap-3">
          <Button
            onClick={handleAIDataCleaning}
            disabled={isProcessing}
            className="gap-2"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isProcessing ? "Cleaning Data..." : "Clean with AI"}
          </Button>
          
          <Button
            onClick={skipAICleaning}
            disabled={isProcessing}
            variant="outline"
          >
            Skip AI Cleaning
          </Button>
        </div>
      )}

      {hasProcessed && cleaningSuggestions.length > 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Cleaning Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {globalSuggestions.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Overall Observations:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {globalSuggestions.map((suggestion, index) => (
                      <li key={index}>• {suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div>
                <h4 className="font-medium mb-2">
                  Improvements Found: {cleaningSuggestions.length} artworks
                </h4>
                <p className="text-sm text-muted-foreground">
                  AI has identified potential improvements for data quality, formatting, and completeness.
                </p>
              </div>
              
              <div className="flex gap-3">
                <Button onClick={applySuggestions}>
                  Apply AI Suggestions
                </Button>
                <Button onClick={skipAICleaning} variant="outline">
                  Use Original Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {hasProcessed && cleaningSuggestions.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h4 className="font-medium mb-2">Data Quality Looks Good!</h4>
            <p className="text-sm text-muted-foreground mb-4">
              AI analysis found no significant issues with your data quality. Proceeding to preview...
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button onClick={onBack} variant="outline" disabled={isProcessing}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <Button 
          onClick={onNext} 
          disabled={!hasProcessed}
          className={hasProcessed ? "opacity-50 cursor-not-allowed" : ""}
        >
          Next
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
