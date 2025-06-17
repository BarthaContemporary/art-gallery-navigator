import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useBulkImageProcessing } from "@/hooks/use-bulk-image-processing";
import { useImageDiagnostics } from "@/hooks/use-image-diagnostics";
import { Wand2, Search, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";

export function BulkImageOptimizer() {
  const [diagnosticsResult, setDiagnosticsResult] = useState<any>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  
  const {
    isProcessing,
    progress,
    processAllImages,
    currentOperation,
    results
  } = useBulkImageProcessing();

  const { diagnoseImageUrls, triggerBatchProcessing } = useImageDiagnostics();

  const handleDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    const result = await diagnoseImageUrls();
    setDiagnosticsResult(result);
    setIsRunningDiagnostics(false);
  };

  const handleBatchFix = async () => {
    if (diagnosticsResult?.issues) {
      const totalIssues = diagnosticsResult.issues.missingCloudinary + diagnosticsResult.issues.unprocessed;
      await triggerBatchProcessing(Math.min(totalIssues, 20)); // Limit to 20 at once
    }
  };

  return (
    <div className="space-y-6">
      {/* Diagnostics Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Image Diagnostics
          </CardTitle>
          <CardDescription>
            Check for image loading issues and broken Cloudinary URLs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleDiagnostics}
            disabled={isRunningDiagnostics}
            variant="outline"
            className="w-full"
          >
            {isRunningDiagnostics ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Running Diagnostics...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Run Image Diagnostics
              </>
            )}
          </Button>

          {diagnosticsResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-muted/50 rounded">
                  <div className="text-2xl font-bold">{diagnosticsResult.totalChecked}</div>
                  <div className="text-sm text-muted-foreground">Images Checked</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded">
                  <div className="text-2xl font-bold text-red-600">
                    {diagnosticsResult.issues.missingCloudinary + diagnosticsResult.issues.malformed}
                  </div>
                  <div className="text-sm text-muted-foreground">Issues Found</div>
                </div>
              </div>

              <div className="space-y-2">
                {diagnosticsResult.issues.missingCloudinary > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Missing Cloudinary URLs</span>
                    <Badge variant="destructive">{diagnosticsResult.issues.missingCloudinary}</Badge>
                  </div>
                )}
                {diagnosticsResult.issues.unprocessed > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Unprocessed Images</span>
                    <Badge variant="secondary">{diagnosticsResult.issues.unprocessed}</Badge>
                  </div>
                )}
                {diagnosticsResult.issues.malformed > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Malformed URLs</span>
                    <Badge variant="destructive">{diagnosticsResult.issues.malformed}</Badge>
                  </div>
                )}
              </div>

              {(diagnosticsResult.issues.missingCloudinary > 0 || diagnosticsResult.issues.unprocessed > 0) && (
                <Button 
                  onClick={handleBatchFix}
                  className="w-full"
                  variant="default"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Fix Issues Automatically
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Existing Bulk Processing Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Bulk Image Optimization
          </CardTitle>
          <CardDescription>
            Process and optimize all artwork images with Cloudinary
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={processAllImages}
            disabled={isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Processing Images...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Start Bulk Optimization
              </>
            )}
          </Button>

          {isProcessing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>{currentOperation}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {results && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Processing complete: {results.successful} successful, {results.failed} failed
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
