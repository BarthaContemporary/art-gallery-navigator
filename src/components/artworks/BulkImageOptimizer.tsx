
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Wand2, Image, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
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

  const progressPercentage = progress.total > 0 ? 
    Math.round(((progress.processed + progress.failed) / progress.total) * 100) : 0;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          Bulk Image Optimization
        </CardTitle>
        <CardDescription>
          Optimize existing artwork images through Cloudinary for better performance and quality
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
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Processing Progress</span>
              <span>{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="w-full" />
            
            {progress.current && (
              <p className="text-xs text-muted-foreground">{progress.current}</p>
            )}
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-muted-foreground">Processed</span>
                </div>
                <div className="text-sm font-medium">{progress.processed}</div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1">
                  <AlertCircle className="h-3 w-3 text-red-500" />
                  <span className="text-xs text-muted-foreground">Failed</span>
                </div>
                <div className="text-sm font-medium">{progress.failed}</div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1">
                  <Image className="h-3 w-3 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Total</span>
                </div>
                <div className="text-sm font-medium">{progress.total}</div>
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
            All images have been optimized through Cloudinary
          </div>
        )}
      </CardContent>
    </Card>
  );
}
