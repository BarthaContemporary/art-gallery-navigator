
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface UploadProgressProps {
  progress: number;
  status: 'uploading' | 'success' | 'error' | 'idle';
  fileName?: string;
  error?: string;
}

export function UploadProgress({ progress, status, fileName, error }: UploadProgressProps) {
  if (status === 'idle') return null;

  return (
    <div className="space-y-2 p-4 border rounded-lg bg-white">
      <div className="flex items-center gap-2">
        {status === 'uploading' && (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
        )}
        {status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
        {status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
        
        <span className="text-sm font-medium truncate">
          {fileName || 'Uploading file...'}
        </span>
      </div>
      
      {status === 'uploading' && (
        <Progress value={progress} className="w-full" />
      )}
      
      {status === 'error' && error && (
        <div className="flex items-start gap-2 p-2 bg-red-50 rounded text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {status === 'success' && (
        <div className="text-sm text-green-600">
          Upload completed successfully!
        </div>
      )}
    </div>
  );
}
