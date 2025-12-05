import { useRef } from "react";
import { useTaskAttachments, useUploadAttachment, useDeleteAttachment } from "@/hooks/projects/use-task-attachments";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Paperclip, Upload, Trash2, FileText, Image, File, Loader2, Download } from "lucide-react";

interface TaskAttachmentsProps {
  taskId: string;
}

export function TaskAttachments({ taskId }: TaskAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: attachments, isLoading } = useTaskAttachments(taskId);
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAttachment.mutate({ task_id: taskId, file });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleDelete = (id: string, file_url: string) => {
    deleteAttachment.mutate({ id, task_id: taskId, file_url });
  };
  
  const getFileIcon = (mimeType: string | null) => {
    if (mimeType?.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (mimeType?.includes('pdf')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };
  
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Attachments
        </h4>
        <span className="text-xs text-muted-foreground">
          {attachments?.length || 0} files
        </span>
      </div>
      
      {/* Attachment list */}
      <div className="space-y-2">
        {attachments?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No attachments yet
          </p>
        )}
        {attachments?.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center gap-3 p-2 border border-border group hover:bg-muted/50"
          >
            {attachment.mime_type?.startsWith('image/') ? (
              <img
                src={attachment.file_url}
                alt={attachment.file_name}
                className="h-10 w-10 object-cover"
              />
            ) : (
              <div className="h-10 w-10 flex items-center justify-center bg-muted">
                {getFileIcon(attachment.mime_type)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{attachment.file_name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(attachment.file_size)} • {formatDistanceToNow(new Date(attachment.created_at), { addSuffix: true })}
              </p>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                asChild
              >
                <a href={attachment.file_url} download target="_blank" rel="noopener noreferrer">
                  <Download className="h-3 w-3" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleDelete(attachment.id, attachment.file_url)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Upload button */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploadAttachment.isPending}
      >
        {uploadAttachment.isPending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Upload className="h-4 w-4 mr-2" />
        )}
        Upload File
      </Button>
    </div>
  );
}
