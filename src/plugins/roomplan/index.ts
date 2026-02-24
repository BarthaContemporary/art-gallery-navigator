import { registerPlugin } from "@capacitor/core";
import type { RoomPlanScannerPlugin } from "./definitions";

const RoomPlanScanner = registerPlugin<RoomPlanScannerPlugin>("RoomPlanScanner", {
  web: () => import("./web").then((m) => new m.RoomPlanScannerWeb()),
});

export * from "./definitions";
export { RoomPlanScanner };
