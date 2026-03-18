/**
 * Depth data utility hooks for PhotoTour
 * 
 * Provides React hooks for checking and extracting depth data
 * from spatial photos in the tour capture pipeline.
 */

import { useState, useCallback } from "react";
import type { DepthMapResult } from "@/plugins/spatial-photo/definitions";

interface UseDepthExtractionReturn {
  /** Whether depth extraction is in progress */
  extracting: boolean;
  /** Extract depth from an image file (native iOS) or URL (web) */
  extractDepth: (fileOrUrl: File | string) => Promise<DepthMapResult | null>;
  /** Check if a file likely contains depth data (quick check via EXIF) */
  checkForDepth: (file: File) => Promise<boolean>;
}

/**
 * Hook for extracting depth data from spatial photos.
 * Automatically selects native or web fallback.
 */
export function useDepthExtraction(): UseDepthExtractionReturn {
  const [extracting, setExtracting] = useState(false);

  const extractDepth = useCallback(async (fileOrUrl: File | string): Promise<DepthMapResult | null> => {
    setExtracting(true);
    try {
      const { getSpatialPhotoPlugin } = await import("@/plugins/spatial-photo");
      const plugin = await getSpatialPhotoPlugin();

      const filePath = typeof fileOrUrl === "string"
        ? fileOrUrl
        : URL.createObjectURL(fileOrUrl);

      const result = await plugin.extractDepth({
        filePath,
        maxResolution: 256, // Keep depth maps small for performance
      });

      // Clean up object URL
      if (typeof fileOrUrl !== "string") {
        URL.revokeObjectURL(filePath);
      }

      return result.hasDepth ? result : null;
    } catch (err) {
      console.warn("Depth extraction failed:", err);
      return null;
    } finally {
      setExtracting(false);
    }
  }, []);

  const checkForDepth = useCallback(async (file: File): Promise<boolean> => {
    try {
      // Quick EXIF check — look for spatial photo markers
      const { default: exifr } = await import("exifr");
      const exif = await exifr.parse(file, {
        tiff: true,
        xmp: true,
        icc: false,
        iptc: false,
      });

      if (!exif) return false;

      // Spatial photo indicators
      return !!(
        exif.MediaGroupUUID || // Stereo pair marker
        exif.HasExtendedXMP || // Extended depth data
        (exif.Make === "Apple" && exif.LensModel?.includes("back")) // iPhone with LiDAR
      );
    } catch {
      return false;
    }
  }, []);

  return { extracting, extractDepth, checkForDepth };
}
