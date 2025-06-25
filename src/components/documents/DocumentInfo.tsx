
import { EnhancedDocument } from "@/hooks/use-enhanced-documents";
import { FileText, Calendar, FolderOpen, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface DocumentInfoProps {
  document: EnhancedDocument;
}

export function DocumentInfo({ document }: DocumentInfoProps) {
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown size";
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-medium truncate">{document.file_name}</h3>
        {document.is_favorite && (
          <Star className="h-4 w-4 text-yellow-500 fill-current" />
        )}
      </div>
      
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary" className="text-xs">
          {document.type}
        </Badge>
        
        {document.file_size && (
          <span>{formatFileSize(document.file_size)}</span>
        )}
        
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>{formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}</span>
        </div>
      </div>
    </div>
  );
}
