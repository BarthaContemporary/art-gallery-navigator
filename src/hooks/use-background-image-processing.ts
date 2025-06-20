
import { useEffect } from "react";
import { BackgroundImageProcessor } from "@/services/background-image-processor";
import { logger } from "@/lib/logger";

export function useBackgroundImageProcessing(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    logger.log('[Background Image Processing] Starting background processor');
    BackgroundImageProcessor.start();

    return () => {
      logger.log('[Background Image Processing] Stopping background processor');
      BackgroundImageProcessor.stop();
    };
  }, [enabled]);
}
