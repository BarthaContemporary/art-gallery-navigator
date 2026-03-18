/**
 * Spatial Photo Depth Extraction Plugin
 * 
 * Extracts depth/disparity data from iPhone Spatial Photos (iPhone 15 Pro+).
 * Spatial photos embed auxiliary depth maps in the HEIF container via
 * AVDepthData (kCGImageAuxiliaryDataTypeDepth / kCGImageAuxiliaryDataTypeDisparity).
 * 
 * On native iOS (Capacitor), this plugin uses AVFoundation to extract the
 * depth map. On the web, a JS fallback attempts to parse HEIF auxiliary data
 * but may have limited support.
 */

export interface DepthPixel {
  /** Normalised depth value 0..1 (0 = closest, 1 = farthest) */
  depth: number;
}

export interface DepthMapResult {
  /** Whether depth data was found in the image */
  hasDepth: boolean;
  /** Width of the depth map in pixels */
  width: number;
  /** Height of the depth map in pixels */
  height: number;
  /** 
   * Flat array of normalised depth values (row-major, length = width * height).
   * Values are 0..1 where 0 is nearest and 1 is farthest.
   * null if no depth data found.
   */
  depthMap: number[] | null;
  /** Minimum real-world depth in metres (if calibrated), null otherwise */
  nearPlaneMetres: number | null;
  /** Maximum real-world depth in metres (if calibrated), null otherwise */
  farPlaneMetres: number | null;
  /** Type of depth data found */
  depthType: "depth" | "disparity" | "none";
  /** Whether photo is a true spatial photo (stereoscopic pair) */
  isSpatialPhoto: boolean;
  /** Camera intrinsics if available */
  intrinsics: CameraIntrinsics | null;
}

export interface CameraIntrinsics {
  /** Focal length in pixels (fx) */
  focalLengthX: number;
  /** Focal length in pixels (fy) */
  focalLengthY: number;
  /** Principal point X */
  principalPointX: number;
  /** Principal point Y */
  principalPointY: number;
}

export interface SpatialPhotoPlugin {
  /**
   * Check if device supports spatial photo capture
   * (iPhone 15 Pro+ with iOS 17+)
   */
  isSupported(): Promise<{ supported: boolean; reason?: string }>;

  /**
   * Extract depth map from a photo file.
   * Works with HEIC spatial photos and Portrait Mode photos.
   * 
   * @param options.filePath - Local file path or asset URL of the photo
   * @param options.maxResolution - Max dimension for the depth map (default 256 for performance)
   */
  extractDepth(options: {
    filePath: string;
    maxResolution?: number;
  }): Promise<DepthMapResult>;

  /**
   * Check if a specific photo contains depth data without extracting it.
   * Faster than full extraction.
   */
  hasDepthData(options: { filePath: string }): Promise<{
    hasDepth: boolean;
    depthType: "depth" | "disparity" | "none";
    isSpatialPhoto: boolean;
  }>;
}
