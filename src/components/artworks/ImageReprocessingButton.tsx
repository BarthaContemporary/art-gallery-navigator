
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ImageReprocessingService } from "@/services/image-reprocessing-service";
import { logger } from "@/lib/logger";

export function ImageReprocessingButton() {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleReprocessing = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    
    try {
      toast.info("Checking for images that need reprocessing...");
      
      const result = await ImageReprocessingService.runReprocessingCheck();
      
      if (result.artworksNeedingProcessing === 0 && result.failedImagesFound === 0) {
        toast.success("All images are properly processed!", {
          description: "No reprocessing needed."
        });
      } else {
        const messages = [];
        if (result.recordsCreated > 0) {
          messages.push(`Created ${result.recordsCreated} new image records`);
        }
        if (result.processingRetried > 0) {
          messages.push(`Retried ${result.processingRetried} failed images`);
        }
        
        toast.success("Image reprocessing initiated", {
          description: messages.join(", ") + ". Check back in a few minutes."
        });
      }
      
      logger.log("[ImageReprocessingButton] Reprocessing completed:", result);
      
    } catch (error) {
      logger.error("[ImageReprocessingButton] Reprocessing failed:", error);
      toast.error("Failed to run image reprocessing check");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Button
      onClick={handleReprocessing}
      disabled={isProcessing}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
    >
      {isProcessing ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle className="h-4 w-4" />
      )}
      {isProcessing ? "Checking..." : "Fix Images"}
    </Button>
  );
}
