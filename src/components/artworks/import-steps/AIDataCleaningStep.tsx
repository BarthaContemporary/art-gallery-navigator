import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, CheckCircle, AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ValidatedProcessedArtwork, FieldMappings } from "../ArtworkFieldMapping.types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AIDataCleaningStepProps {
  parsedArtworks: ValidatedProcessedArtwork[];
  fieldMappings: FieldMappings;
  onCleaningComplete: (cleanedArtworks: ValidatedProcessedArtwork[]) => void;
  onBack: () => void;
  onNext: () => void;
}

interface DataCleaningSuggestion {
  originalRowIndex: number;
  suggestedChanges: Record<string, {
    original: string;
    suggested: string;
    reason: string;
  }>;
  qualityScore: number;
  warnings: string[];
}

export function AIDataCleaningStep({
  parsedArtworks,
  fieldMappings,
  onCleaningComplete,
  onBack,
  onNext,
}: AIDataCleaningStepProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<DataCleaningSuggestion[]>([]);
  const [globalSuggestions, setGlobalSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const handleAIDataCleaning = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-data-cleaner', {
        body: {
          artworks: parsedArtworks.map(item => item.artwork),
          fieldMappings
        }
      });

      if (error) throw error;

      setSuggestions(data.cleanedArtworks || []);
      setGlobalSuggestions(data.globalSuggestions || []);
      setShowSuggestions(true);
      
      toast({
        title: "AI Data Cleaning Complete",
        description: `Found ${data.cleanedArtworks?.length || 0} improvement suggestions`,
      });
    } catch (error) {
      console.error('AI data cleaning error:', error);
      toast({
        title: "AI Data Cleaning Error",
        description: "Failed to get AI data cleaning suggestions.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const applySuggestion = (suggestionIndex: number, fieldName: string) => {
    const suggestion = suggestions[suggestionIndex];
    if (!suggestion) return;

    const updatedArtworks = [...parsedArtworks];
    const artworkIndex = suggestion.originalRowIndex;
    const change = suggestion.suggestedChanges[fieldName];
    
    if (change && updatedArtworks[artworkIndex]) {
      (updatedArtworks[artworkIndex].artwork as any)[fieldName] = change.suggested;
      setAppliedSuggestions(prev => new Set([...prev, suggestionIndex]));
      onCleaningComplete(updatedArtworks);
      
      toast({
        title: "Change Applied",
        description: `Updated ${fieldName} for artwork ${artworkIndex + 1}`,
      });
    }
  };

  const applyAllSuggestions = () => {
    const updatedArtworks = [...parsedArtworks];
    let appliedCount = 0;

    suggestions.forEach((suggestion, suggestionIndex) => {
      const artworkIndex = suggestion.originalRowIndex;
      if (updatedArtworks[artworkIndex] && suggestion.qualityScore > 0.7) {
        Object.entries(suggestion.suggestedChanges).forEach(([fieldName, change]) => {
          (updatedArtworks[artworkIndex].artwork as any)[fieldName] = change.suggested;
        });
        appliedCount++;
        setAppliedSuggestions(prev => new Set([...prev, suggestionIndex]));
      }
    });

    onCleaningComplete(updatedArtworks);
    
    toast({
      title: "All Suggestions Applied",
      description: `Applied ${appliedCount} high-quality data improvements`,
    });
  };

  const skipCleaning = () => {
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Sparkles className="h-8 w-8 text-primary" />
          <h2 className="text-2xl font-semibold">AI Data Cleaning</h2>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Let AI analyze your data and suggest improvements for consistency, accuracy, and completeness.
        </p>
      </div>

      {!showSuggestions ? (
        <div className="text-center space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <Card>
              <CardHeader className="text-center">
                <CheckCircle className="h-6 w-6 text-green-600 mx-auto" />
                <CardTitle className="text-sm">Data Standardization</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  Standardize formats for dates, currencies, dimensions, and other data types
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="text-center">
                <AlertTriangle className="h-6 w-6 text-yellow-600 mx-auto" />
                <CardTitle className="text-sm">Quality Validation</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  Identify and flag suspicious or inconsistent data entries
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="text-center">
                <Sparkles className="h-6 w-6 text-primary mx-auto" />
                <CardTitle className="text-sm">Smart Corrections</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  Fix common issues like extra spaces, capitalization, and formatting
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center gap-4">
            <Button
              onClick={handleAIDataCleaning}
              disabled={isProcessing}
              size="lg"
              className="gap-2"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isProcessing ? "Analyzing Data..." : "Start AI Data Cleaning"}
            </Button>
            <Button
              onClick={skipCleaning}
              variant="outline"
              size="lg"
            >
              Skip This Step
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {globalSuggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Overall Data Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {globalSuggestions.map((insight, index) => (
                    <li key={index} className="text-sm text-muted-foreground">• {insight}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Data Cleaning Suggestions</h3>
                <Button
                  onClick={applyAllSuggestions}
                  className="gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Apply All High Quality
                </Button>
              </div>

              <div className="space-y-3">
                {suggestions.slice(0, 10).map((suggestion, suggestionIndex) => (
                  <Card key={suggestionIndex} className={appliedSuggestions.has(suggestionIndex) ? 'bg-green-50 border-green-200' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">
                          Artwork {suggestion.originalRowIndex + 1}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant={suggestion.qualityScore > 0.8 ? 'default' : suggestion.qualityScore > 0.6 ? 'secondary' : 'outline'}>
                            {Math.round(suggestion.qualityScore * 100)}% confidence
                          </Badge>
                          {appliedSuggestions.has(suggestionIndex) && (
                            <Badge variant="default" className="bg-green-600">Applied</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {Object.entries(suggestion.suggestedChanges).map(([fieldName, change]) => (
                        <div key={fieldName} className="border rounded p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{fieldName}</span>
                            <Button
                              onClick={() => applySuggestion(suggestionIndex, fieldName)}
                              size="sm"
                              variant="outline"
                              disabled={appliedSuggestions.has(suggestionIndex)}
                            >
                              Apply
                            </Button>
                          </div>
                          <div className="text-xs space-y-1">
                            <div><span className="font-medium">Current:</span> "{change.original}"</div>
                            <div><span className="font-medium">Suggested:</span> "{change.suggested}"</div>
                            <div className="text-muted-foreground">{change.reason}</div>
                          </div>
                        </div>
                      ))}
                      
                      {suggestion.warnings.length > 0 && (
                        <div className="mt-2">
                          <span className="text-sm font-medium text-yellow-600">Warnings:</span>
                          <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                            {suggestion.warnings.map((warning, idx) => (
                              <li key={idx}>• {warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {suggestions.length > 10 && (
                <p className="text-sm text-muted-foreground text-center">
                  Showing first 10 suggestions. {suggestions.length - 10} more available.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <Button onClick={onBack} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={onNext}>
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}