
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
    progress,
    processAllImages,
    getUnprocessedCount
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

  // Calculate progress percentage from the progress object
  const progressPercentage = progress.total > 0 ? ((progress.processed + progress.failed) / progress.total) * 100 : 0;
  const artistProgressPercentage = (progress.artistsTotal || 0) > 0 ? 
    ((progress.artistsProcessed || 0) + (progress.artistsFailed || 0)) / (progress.artistsTotal || 1) * 100 : 0;

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

      {/* Bulk Processing Section */}
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
            disabled={progress.isRunning}
            className="w-full"
          >
            {progress.isRunning ? (
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

          {progress.isRunning && (
            <div className="space-y-3">
              {/* Artwork Images Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Artwork Images: {progress.processed + progress.failed} / {progress.total}</span>
                  <span>{Math.round(progressPercentage)}%</span>
                </div>
                <Progress value={progressPercentage} className="w-full" />
              </div>

              {/* Artist Images Progress */}
              {(progress.artistsTotal || 0) > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Artist Images: {(progress.artistsProcessed || 0) + (progress.artistsFailed || 0)} / {progress.artistsTotal}</span>
                    <span>{Math.round(artistProgressPercentage)}%</span>
                  </div>
                  <Progress value={artistProgressPercentage} className="w-full" />
                </div>
              )}

              {/* Current Operation */}
              {progress.current && (
                <div className="text-sm text-muted-foreground">
                  {progress.current}
                </div>
              )}
            </div>
          )}

          {!progress.isRunning && (progress.processed > 0 || progress.failed > 0) && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Processing complete: {progress.processed + (progress.artistsProcessed || 0)} successful, {progress.failed + (progress.artistsFailed || 0)} failed
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
