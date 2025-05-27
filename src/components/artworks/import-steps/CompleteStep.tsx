
import { Button } from "@/components/ui/button";
import { ImportStats } from "./types";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface CompleteStepProps {
  importStats: ImportStats;
  onClose: () => void;
}

export function CompleteStep({ importStats, onClose }: CompleteStepProps) {
  const { successful, failed, skipped, total } = importStats;

  return (
    <div className="flex flex-col items-center justify-center space-y-6 p-8">
      <CheckCircle2 className="h-16 w-16 text-green-500" />
      <h2 className="text-2xl font-semibold">Import Complete!</h2>
      
      <div className="text-center space-y-1 text-muted-foreground">
        <p>Total artworks processed: {total}</p>
        <p className="flex items-center justify-center">
          <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
          Successfully imported: {successful}
        </p>
        {failed > 0 && (
          <p className="flex items-center justify-center text-red-500">
            <XCircle className="h-5 w-5 mr-2" />
            Failed to import: {failed}
          </p>
        )}
        {skipped > 0 && (
          <p className="flex items-center justify-center text-yellow-600">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Skipped (duplicates): {skipped}
          </p>
        )}
      </div>
      
      {failed > 0 && (
          <p className="text-sm text-muted-foreground">
              Please check the console for details on failed imports.
          </p>
      )}

      <Button onClick={onClose} className="mt-4">
        Close
      </Button>
    </div>
  );
}
