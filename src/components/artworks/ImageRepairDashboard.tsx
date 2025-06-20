
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { RefreshCw, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { ImageRepairService } from "@/services/image-repair-service";
import { LocalImageRecord } from "@/services/local-image-service";
import { logger } from "@/lib/logger";

export function ImageRepairDashboard() {
  const [statusSummary, setStatusSummary] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    stuck: 0
  });
  
  const [failedImages, setFailedImages] = useState<LocalImageRecord[]>([]);
  const [stuckImages, setStuckImages] = useState<LocalImageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState<Set<string>>(new Set());

  const loadData = async () => {
    setLoading(true);
    try {
      const [summary, failed, stuck] = await Promise.all([
        ImageRepairService.getProcessingStatusSummary(),
        ImageRepairService.findFailedImages(),
        ImageRepairService.findStuckImages()
      ]);
      
      setStatusSummary(summary);
      setFailedImages(failed);
      setStuckImages(stuck);
    } catch (error) {
      logger.error('[ImageRepairDashboard] Failed to load data:', error);
      toast.error('Failed to load repair dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRetryImage = async (imageId: string) => {
    setRepairing(prev => new Set(prev).add(imageId));
    
    try {
      const result = await ImageRepairService.retryImageProcessing(imageId);
      
      if (result.success) {
        toast.success('Image processing retry initiated');
        await loadData(); // Refresh data
      } else {
        toast.error(`Retry failed: ${result.error}`);
      }
    } catch (error) {
      logger.error('[ImageRepairDashboard] Retry failed:', error);
      toast.error('Failed to retry image processing');
    } finally {
      setRepairing(prev => {
        const newSet = new Set(prev);
        newSet.delete(imageId);
        return newSet;
      });
    }
  };

  const handleBatchRetry = async (imageIds: string[]) => {
    if (imageIds.length === 0) return;
    
    setLoading(true);
    toast.info(`Starting batch retry for ${imageIds.length} images...`);
    
    try {
      const result = await ImageRepairService.batchRetryImages(imageIds);
      
      if (result.successful.length > 0) {
        toast.success(`Successfully retried ${result.successful.length} images`);
      }
      
      if (result.failed.length > 0) {
        toast.error(`Failed to retry ${result.failed.length} images`);
        logger.error('[ImageRepairDashboard] Batch retry failures:', result.failed);
      }
      
      await loadData(); // Refresh data
    } catch (error) {
      logger.error('[ImageRepairDashboard] Batch retry failed:', error);
      toast.error('Batch retry failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    setLoading(true);
    toast.info('Starting cleanup of orphaned records...');
    
    try {
      const result = await ImageRepairService.cleanupOrphanedRecords();
      
      if (result.cleaned > 0) {
        toast.success(`Cleaned up ${result.cleaned} orphaned records`);
      } else {
        toast.info('No orphaned records found');
      }
      
      if (result.errors.length > 0) {
        toast.error(`Cleanup had ${result.errors.length} errors`);
        logger.error('[ImageRepairDashboard] Cleanup errors:', result.errors);
      }
      
      await loadData(); // Refresh data
    } catch (error) {
      logger.error('[ImageRepairDashboard] Cleanup failed:', error);
      toast.error('Cleanup failed');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'processing': return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Image Processing Repair Dashboard</h2>
        <Button onClick={loadData} disabled={loading} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{statusSummary.total}</div>
            <div className="text-sm text-muted-foreground">Total Images</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{statusSummary.completed}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{statusSummary.failed}</div>
            <div className="text-sm text-muted-foreground">Failed</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{statusSummary.processing}</div>
            <div className="text-sm text-muted-foreground">Processing</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{statusSummary.pending}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{statusSummary.stuck}</div>
            <div className="text-sm text-muted-foreground">Stuck</div>
          </CardContent>
        </Card>
      </div>

      {/* Batch Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={() => handleBatchRetry(failedImages.map(img => img.id))}
              disabled={loading || failedImages.length === 0}
              variant="destructive"
            >
              Retry All Failed ({failedImages.length})
            </Button>
            
            <Button 
              onClick={() => handleBatchRetry(stuckImages.map(img => img.id))}
              disabled={loading || stuckImages.length === 0}
              variant="outline"
            >
              Retry All Stuck ({stuckImages.length})
            </Button>
            
            <Button 
              onClick={handleCleanup}
              disabled={loading}
              variant="secondary"
            >
              Cleanup Orphaned Records
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Failed Images */}
      {failedImages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Failed Images ({failedImages.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {failedImages.map((image) => (
                <div key={image.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      Image ID: {image.id}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      Artwork: {image.artwork_id}
                    </div>
                    {image.processing_error && (
                      <div className="text-xs text-red-600 truncate">
                        Error: {image.processing_error}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Badge variant="destructive">Failed</Badge>
                    <Button
                      size="sm"
                      onClick={() => handleRetryImage(image.id)}
                      disabled={repairing.has(image.id)}
                    >
                      {repairing.has(image.id) ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        'Retry'
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stuck Images */}
      {stuckImages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Stuck Images ({stuckImages.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                These images have been processing for more than 30 minutes and may be stuck.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              {stuckImages.map((image) => (
                <div key={image.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      Image ID: {image.id}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      Artwork: {image.artwork_id}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created: {new Date(image.created_at || '').toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <div className="flex items-center gap-1">
                      {getStatusIcon(image.processing_status)}
                      <Badge variant={image.processing_status === 'processing' ? 'default' : 'secondary'}>
                        {image.processing_status}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleRetryImage(image.id)}
                      disabled={repairing.has(image.id)}
                    >
                      {repairing.has(image.id) ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        'Retry'
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
