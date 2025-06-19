
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useImageHealthChecker } from '@/hooks/use-image-health-checker';
import { useBulkImageProcessing } from '@/hooks/use-bulk-image-processing';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Image, Zap } from 'lucide-react';
import { toast } from 'sonner';

export function ImageHealthDashboard() {
  const [healthReport, setHealthReport] = useState<any>(null);
  const { checkImageHealth, fixBrokenImages, reprocessUnoptimizedImages, isChecking, isFixing } = useImageHealthChecker();
  const { progress, processAllImages, getUnprocessedCount } = useBulkImageProcessing();
  const [unprocessedCount, setUnprocessedCount] = useState(0);

  useEffect(() => {
    loadHealthReport();
    loadUnprocessedCount();
  }, []);

  const loadHealthReport = async () => {
    try {
      const report = await checkImageHealth();
      setHealthReport(report);
    } catch (error) {
      console.error('Failed to load health report:', error);
      toast.error('Failed to load image health report');
    }
  };

  const loadUnprocessedCount = async () => {
    try {
      const count = await getUnprocessedCount();
      setUnprocessedCount(count);
    } catch (error) {
      console.error('Failed to load unprocessed count:', error);
    }
  };

  const handleFixBrokenImages = async () => {
    if (!healthReport) return;
    
    try {
      await fixBrokenImages(healthReport);
      await loadHealthReport(); // Refresh report
      toast.success('Broken images fixed successfully');
    } catch (error) {
      console.error('Failed to fix broken images:', error);
      toast.error('Failed to fix broken images');
    }
  };

  const handleReprocessImages = async () => {
    try {
      await reprocessUnoptimizedImages();
      await loadHealthReport();
      await loadUnprocessedCount();
      toast.success('Image reprocessing completed');
    } catch (error) {
      console.error('Failed to reprocess images:', error);
      toast.error('Failed to reprocess images');
    }
  };

  const handleBulkProcess = async () => {
    try {
      await processAllImages();
      await loadHealthReport();
      await loadUnprocessedCount();
    } catch (error) {
      console.error('Bulk processing failed:', error);
    }
  };

  const getHealthPercentage = () => {
    if (!healthReport) return 0;
    const { totalImages, brokenImages } = healthReport;
    if (totalImages === 0) return 100;
    return Math.round(((totalImages - brokenImages) / totalImages) * 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return 'bg-green-500';
      case 'fixable': return 'bg-yellow-500';
      case 'broken': return 'bg-red-500';
      case 'placeholder': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Health Overview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Image Health</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getHealthPercentage()}%</div>
            <p className="text-xs text-muted-foreground">
              {healthReport ? `${healthReport.totalImages - healthReport.brokenImages}/${healthReport.totalImages} working` : 'Loading...'}
            </p>
            <Progress value={getHealthPercentage()} className="mt-2" />
          </CardContent>
        </Card>

        {/* Cloudinary Images */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cloudinary Optimized</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthReport?.cloudinaryImages || 0}</div>
            <p className="text-xs text-muted-foreground">
              CDN optimized images
            </p>
          </CardContent>
        </Card>

        {/* Broken Images */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Broken Images</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{healthReport?.brokenImages || 0}</div>
            <p className="text-xs text-muted-foreground">
              Need attention
            </p>
          </CardContent>
        </Card>

        {/* Fixable Images */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto-Fixable</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{healthReport?.fixableImages || 0}</div>
            <p className="text-xs text-muted-foreground">
              Can be auto-fixed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Image Management Actions</CardTitle>
          <CardDescription>
            Tools to diagnose and fix image loading issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={loadHealthReport}
              disabled={isChecking}
              variant="outline"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
              Refresh Health Check
            </Button>

            <Button
              onClick={handleFixBrokenImages}
              disabled={isFixing || !healthReport?.fixableImages}
              variant="default"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Fix Broken URLs ({healthReport?.fixableImages || 0})
            </Button>

            <Button
              onClick={handleReprocessImages}
              disabled={isFixing}
              variant="secondary"
            >
              <Image className="w-4 h-4 mr-2" />
              Reprocess Unoptimized
            </Button>

            <Button
              onClick={handleBulkProcess}
              disabled={progress.isRunning}
              variant="destructive"
            >
              <Zap className="w-4 h-4 mr-2" />
              Bulk Process All ({unprocessedCount})
            </Button>
          </div>

          {/* Bulk Processing Progress */}
          {progress.isRunning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing images...</span>
                <span>{progress.processed + (progress.artistsProcessed || 0)} / {progress.total + (progress.artistsTotal || 0)}</span>
              </div>
              <Progress 
                value={((progress.processed + (progress.artistsProcessed || 0)) / (progress.total + (progress.artistsTotal || 0))) * 100} 
              />
              {progress.current && (
                <p className="text-xs text-muted-foreground">{progress.current}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Health Report */}
      {healthReport && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed Health Report</CardTitle>
            <CardDescription>
              Breakdown of image status across your collection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">{healthReport.cloudinaryImages}</div>
                <div className="text-sm text-muted-foreground">Cloudinary</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">{healthReport.supabaseImages}</div>
                <div className="text-sm text-muted-foreground">Supabase</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-yellow-600">{healthReport.fixableImages}</div>
                <div className="text-sm text-muted-foreground">Fixable</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-red-600">{healthReport.brokenImages}</div>
                <div className="text-sm text-muted-foreground">Broken</div>
              </div>
            </div>

            {/* Sample of problematic images */}
            {healthReport.details.filter((d: any) => d.status !== 'valid').slice(0, 5).length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Issues Found:</h4>
                {healthReport.details
                  .filter((d: any) => d.status !== 'valid')
                  .slice(0, 5)
                  .map((detail: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(detail.status)}>
                          {detail.status}
                        </Badge>
                        <span className="font-mono text-xs truncate max-w-[300px]">
                          {detail.originalUrl}
                        </span>
                      </div>
                      {detail.suggestedFix && (
                        <span className="text-xs text-muted-foreground">
                          Fix available
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
