import { WebPlugin } from "@capacitor/core";
import type { RoomPlanScannerPlugin, RoomScanResult } from "./definitions";

/**
 * Web fallback – RoomPlan is iOS-only.
 * On web, isSupported() returns false and startScan() throws.
 */
export class RoomPlanScannerWeb extends WebPlugin implements RoomPlanScannerPlugin {
  async isSupported(): Promise<{ supported: boolean; reason?: string }> {
    return {
      supported: false,
      reason: "RoomPlan requires an iOS device with a LiDAR sensor (iPhone 12 Pro or later, iOS 16+)",
    };
  }

  async startScan(): Promise<RoomScanResult> {
    throw new Error(
      "RoomPlan scanning is only available on iOS devices with LiDAR. Please open this app on a compatible iPhone or iPad."
    );
  }
}
