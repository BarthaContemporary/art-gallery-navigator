
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Wand2, Image, CheckCircle, AlertCircle, Loader2, Users } from "lucide-react";
import { useBulkImageProcessing } from "@/hooks/use-bulk-image-processing";
import { useAuth } from "@/hooks/use-auth";

export function BulkImageOptimizer() {
  const { isAdmin } = useAuth();
  const { progress, processAllImages, getUnprocessedCount } = useBulkImageProcessing();
  const [unprocessedCount, setUnprocessedCount] = useState<number>(0);

  useEffect(() => {
    const loadUnprocessedCount = async () => {
      const count = await getUnprocessedCount();
      setUnprocessedCount(count);
    };
    
    loadUnprocessedCount();
  }, [getUnprocessedCount, progress.isRunning]);

  if (!isAdmin) {
    return null;
  }

  const artworkProgressPercentage = progress.total > 0 ? 
    Math.round(((progress.processed + progress.failed) / progress.total) * 100) : 0;

  const artistProgressPercentage = (progress.artistsTotal || 0) > 0 ? 
    Math.round((((progress.artistsProcessed || 0) + (progress.artistsFailed || 0)) / (progress.artistsTotal || 0)) * 100) : 0;

  const totalImages = progress.total + (progress.artistsTotal || 0);
  const totalProcessed = progress.processed + (progress.artistsProcessed || 0);
  const totalFailed = progress.failed + (progress.artistsFailed || 0);
  const overallProgressPercentage = totalImages > 0 ? 
    Math.round(((totalProcessed + totalFailed) / totalImages) * 100) : 0;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          Bulk Image Optimization
        </CardTitle>
        <CardDescription>
          Optimize existing artwork images and artist profile photos through Cloudinary for better performance and quality
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            <span className="text-sm font-medium">Unprocessed Images:</span>
          </div>
          <Badge variant={unprocessedCount > 0 ? "destructive" : "secondary"}>
            {unprocessedCount}
          </Badge>
        </div>

        {progress.isRunning && (
          <div className="space-y-4">
            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Overall Progress</span>
                <span>{overallProgressPercentage}%</span>
              </div>
              <Progress value={overallProgressPercentage} className="w-full" />
            </div>

            {/* Artwork Images Progress */}
            {progress.total > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Image className="h-3 w-3" />
                    Artwork Images
                  </span>
                  <span>{artworkProgressPercentage}%</span>
                </div>
                <Progress value={artworkProgressPercentage} className="w-full h-2" />
              </div>
            )}

            {/* Artist Profile Images Progress */}
            {(progress.artistsTotal || 0) > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Artist Profiles
                  </span>
                  <span>{artistProgressPercentage}%</span>
                </div>
                <Progress value={artistProgressPercentage} className="w-full h-2" />
              </div>
            )}
            
            {progress.current && (
              <p className="text-xs text-muted-foreground">{progress.current}</p>
            )}
            
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-muted-foreground">Processed</span>
                </div>
                <div className="text-sm font-medium">
                  {totalProcessed}
                  {progress.isRunning && totalImages > 0 && (
                    <span className="text-xs text-muted-foreground">/{totalImages}</span>
                  )}
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1">
                  <AlertCircle className="h-3 w-3 text-red-500" />
                  <span className="text-xs text-muted-foreground">Failed</span>
                </div>
                <div className="text-sm font-medium">{totalFailed}</div>
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={processAllImages}
          disabled={progress.isRunning || unprocessedCount === 0}
          className="w-full"
          size="lg"
        >
          {progress.isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Optimizing Images...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              {unprocessedCount > 0 
                ? `Optimize ${unprocessedCount} Images` 
                : 'All Images Optimized'
              }
            </>
          )}
        </Button>

        {unprocessedCount === 0 && !progress.isRunning && (
          <div className="text-center text-sm text-green-600 flex items-center justify-center gap-2">
            <CheckCircle className="h-4 w-4" />
            All artwork and artist profile images have been optimized through Cloudinary
          </div>
        )}
      </CardContent>
    </Card>
  );
}
