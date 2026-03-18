/**
 * Web Fallback for Spatial Photo Depth Extraction
 * 
 * On the web, we cannot directly access HEIF auxiliary depth data.
 * This fallback:
 * 1. Checks for depth data in EXIF metadata (limited)
 * 2. Uses the exifr library to detect spatial photo markers
 * 3. Returns a stub result when running outside native iOS
 * 
 * The real depth extraction happens on the native side via the
 * Capacitor plugin (AVDepthData).
 */

import type { DepthMapResult, SpatialPhotoPlugin } from "./definitions";

export class SpatialPhotoWebFallback implements SpatialPhotoPlugin {
  async isSupported(): Promise<{ supported: boolean; reason?: string }> {
    return {
      supported: false,
      reason: "Spatial photo depth extraction requires a native iOS device (iPhone 15 Pro+). On the web, depth data from uploaded spatial photos will be extracted server-side if available.",
    };
  }

  async extractDepth(options: { filePath: string; maxResolution?: number }): Promise<DepthMapResult> {
    // Try to detect depth markers in EXIF using exifr (already in the project)
    try {
      const { default: exifr } = await import("exifr");
      const exif = await exifr.parse(options.filePath, {
        tiff: true,
        xmp: true,
        icc: false,
        iptc: false,
        jfif: false,
      });

      if (exif) {
        // Check for Apple depth markers
        const hasDepthMarker =
          exif.MediaGroupUUID || // Spatial photo pair marker
          exif.ImageDescription?.toLowerCase().includes("depth") ||
          exif.HasExtendedXMP;

        if (hasDepthMarker) {
          return {
            hasDepth: false, // Can't extract on web, but we know it's there
            width: 0,
            height: 0,
            depthMap: null,
            nearPlaneMetres: null,
            farPlaneMetres: null,
            depthType: "none",
            isSpatialPhoto: !!exif.MediaGroupUUID,
            intrinsics: null,
          };
        }
      }
    } catch {
      // EXIF parsing failed — not a blocking error
    }

    return {
      hasDepth: false,
      width: 0,
      height: 0,
      depthMap: null,
      nearPlaneMetres: null,
      farPlaneMetres: null,
      depthType: "none",
      isSpatialPhoto: false,
      intrinsics: null,
    };
  }

  async hasDepthData(options: { filePath: string }): Promise<{
    hasDepth: boolean;
    depthType: "depth" | "disparity" | "none";
    isSpatialPhoto: boolean;
  }> {
    const result = await this.extractDepth(options);
    return {
      hasDepth: result.hasDepth,
      depthType: result.depthType,
      isSpatialPhoto: result.isSpatialPhoto,
    };
  }
}
