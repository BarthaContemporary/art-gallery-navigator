/**
 * Spatial Photo Plugin Entry Point
 * 
 * Uses native Capacitor plugin on iOS, web fallback otherwise.
 */

import { Capacitor } from "@capacitor/core";
import type { SpatialPhotoPlugin } from "./definitions";

export type { DepthMapResult, CameraIntrinsics, SpatialPhotoPlugin } from "./definitions";

let _plugin: SpatialPhotoPlugin | null = null;

export async function getSpatialPhotoPlugin(): Promise<SpatialPhotoPlugin> {
  if (_plugin) return _plugin;

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
    try {
      // Native plugin registered via Capacitor
      const { registerPlugin } = await import("@capacitor/core");
      _plugin = registerPlugin<SpatialPhotoPlugin>("SpatialPhoto");
      return _plugin;
    } catch {
      // Fall through to web
    }
  }

  const { SpatialPhotoWebFallback } = await import("./web-fallback");
  _plugin = new SpatialPhotoWebFallback();
  return _plugin;
}
