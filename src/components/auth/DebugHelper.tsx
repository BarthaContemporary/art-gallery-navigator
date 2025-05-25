
import { useEffect } from "react";
import { logger } from "@/lib/logger";

/**
 * A utility component for debugging
 * Only used in development environments
 */
export function DebugHelper() {
  useEffect(() => {
    // Log some useful debug information when component mounts
    logger.log("Debug Helper loaded");
    logger.log("Current route:", window.location.pathname);
    logger.log("Environment:", process.env.NODE_ENV);

    // Check if running in development
    if (process.env.NODE_ENV === 'development') {
      logger.log("Development mode enabled - showing additional debug info");
    }

    return () => {
      logger.log("Debug Helper unmounted");
    };
  }, []);

  // Return null as this is just a debug utility
  return null;
}
