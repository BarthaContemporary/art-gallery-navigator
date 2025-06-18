
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Brain, Bug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function MapDiagnosticsAI() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");
  const [error, setError] = useState<string>("");

  const analyzeMapIssues = async () => {
    setIsAnalyzing(true);
    setError("");
    setAnalysis("");

    try {
      // Collect current error context
      const errorLogs = `
        - Map container not available after cleanup
        - Map container became unavailable during initialization
        - Container not ready yet, delaying initialization
        - initializeMap called, checking conditions...
        - Map initialization already in progress, skipping...
        - Error during map creation: Map container became unavailable during initialization
      `;

      const codeContext = `
        Current implementation uses:
        - useAddressMap hook for coordination
        - useGoogleMaps hook for map management
        - useGeocoding hook for address resolution
        - Multiple useEffect hooks with complex dependencies
        - Ref management for DOM elements
        - Cleanup functions and timeout management
        - Retry mechanisms with attempt counting
      `;

      const issue = `
        The Google Maps component frequently fails to initialize due to timing issues between:
        1. Component mounting/unmounting
        2. DOM element availability
        3. Google Maps script loading
        4. Address geocoding completion
        5. Map container cleanup and recreation
        
        This creates a race condition where the map container becomes unavailable between cleanup and initialization.
      `;

      const { data, error: functionError } = await supabase.functions.invoke('map-diagnostics-ai', {
        body: {
          errorLogs,
          codeContext,
          issue
        }
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setAnalysis(data.analysis);
    } catch (err) {
      console.error('Map diagnostics error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Map Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            onClick={analyzeMapIssues}
            disabled={isAnalyzing}
            className="flex items-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Bug className="h-4 w-4" />
                Analyze Map Issues
              </>
            )}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {analysis && (
          <div className="space-y-4">
            <h3 className="font-semibold">AI Analysis & Recommendations:</h3>
            <Textarea
              value={analysis}
              readOnly
              className="min-h-[400px] font-mono text-sm"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
