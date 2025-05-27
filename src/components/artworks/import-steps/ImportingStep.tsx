
import { Progress } from "@/components/ui/progress";
import { ImportStats } from "./types";
import { Loader2 } from "lucide-react";

interface ImportingStepProps {
  importingProgress: number;
  importStats: ImportStats;
}

export function ImportingStep({ importingProgress, importStats }: ImportingStepProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-8">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <h2 className="text-xl font-semibold">Importing Artworks...</h2>
      <p className="text-sm text-muted-foreground">
        Please wait while your artworks are being imported. Do not close this window.
      </p>
      <Progress value={importingProgress} className="w-full max-w-md" />
      <div className="text-sm text-muted-foreground pt-2">
        <p>Processed: {importStats.successful + importStats.failed + importStats.skipped} / {importStats.total}</p>
        <p className="text-green-600">Successful: {importStats.successful}</p>
        <p className="text-red-600">Failed: {importStats.failed}</p>
        <p className="text-yellow-600">Skipped (Duplicates): {importStats.skipped}</p>
      </div>
    </div>
  );
}
