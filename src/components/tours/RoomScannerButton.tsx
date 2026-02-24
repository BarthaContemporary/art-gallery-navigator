import { useState, useCallback } from "react";
import { RoomPlanScanner, type RoomScanResult } from "@/plugins/roomplan";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Scan } from "lucide-react";

interface RoomScannerButtonProps {
  onScanComplete: (result: RoomScanResult) => void;
  className?: string;
}

export function RoomScannerButton({ onScanComplete, className }: RoomScannerButtonProps) {
  const [scanning, setScanning] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [unsupportedReason, setUnsupportedReason] = useState<string | null>(null);

  const checkSupport = useCallback(async () => {
    try {
      const result = await RoomPlanScanner.isSupported();
      setSupported(result.supported);
      if (!result.supported) setUnsupportedReason(result.reason || "Not supported");
      return result.supported;
    } catch {
      setSupported(false);
      setUnsupportedReason("RoomPlan plugin not available");
      return false;
    }
  }, []);

  const handleScan = useCallback(async () => {
    const isSupported = await checkSupport();
    if (!isSupported) {
      toast.error(unsupportedReason || "LiDAR scanning requires an iPhone 12 Pro or later with iOS 16+");
      return;
    }

    setScanning(true);
    try {
      const result = await RoomPlanScanner.startScan();
      onScanComplete(result);
      toast.success(
        `Room scanned! ${result.walls.length} walls, ${result.openings.length} openings detected`
      );
    } catch (err: any) {
      toast.error(err.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  }, [checkSupport, unsupportedReason, onScanComplete]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleScan}
      disabled={scanning || supported === false}
      className={className}
    >
      {scanning ? (
        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
      ) : (
        <Scan className="h-4 w-4 mr-1.5" />
      )}
      {scanning ? "Scanning..." : supported === false ? "LiDAR Not Available" : "LiDAR Room Scan"}
    </Button>
  );
}
