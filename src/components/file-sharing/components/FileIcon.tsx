
import { FileText } from "lucide-react";

interface FileIconProps {
  mimeType?: string | null;
}

export function FileIcon({ mimeType }: FileIconProps) {
  if (!mimeType) return <FileText className="h-4 w-4 text-muted-foreground" />;
  
  if (mimeType.startsWith('image/')) {
    return <div className="w-4 h-4 bg-blue-100 rounded flex items-center justify-center text-xs">📷</div>;
  }
  if (mimeType === 'application/pdf') {
    return <div className="w-4 h-4 bg-red-100 rounded flex items-center justify-center text-xs">📄</div>;
  }
  if (mimeType.startsWith('text/')) {
    return <div className="w-4 h-4 bg-green-100 rounded flex items-center justify-center text-xs">📝</div>;
  }
  
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}
