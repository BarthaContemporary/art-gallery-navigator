import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, Download, Trash2, FileText, Image, File, Loader2 } from "lucide-react";
import { useDealAttachments, useUploadDealAttachment, useDeleteDealAttachment } from "@/hooks/crm/use-deal-attachments";
import { toast } from "sonner";
import { format } from "date-fns";

interface DealAttachmentsSectionProps {
  dealId: string;
}

export function DealAttachmentsSection({ dealId }: DealAttachmentsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: attachments, isLoading } = useDealAttachments(dealId);
  const uploadAttachment = useUploadDealAttachment();
  const deleteAttachment = useDeleteDealAttachment();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    try {
      await uploadAttachment.mutateAsync({ deal_id: dealId, file });
      toast.success("File uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload file");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (attachment: { id: string; file_url: string }) => {
    try {
      await deleteAttachment.mutateAsync({
        id: attachment.id,
        deal_id: dealId,
        file_url: attachment.file_url,
      });
      toast.success("File deleted");
    } catch (error) {
      toast.error("Failed to delete file");
    }
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File className="h-4 w-4" />;
    if (mimeType.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (mimeType.includes("pdf")) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Attachments
          {attachments && attachments.length > 0 && (
            <span className="text-muted-foreground">({attachments.length})</span>
          )}
        </h3>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadAttachment.isPending}
        >
          {uploadAttachment.isPending ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Upload className="h-3 w-3 mr-1" />
          )}
          Upload
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : !attachments || attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No attachments yet
        </p>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 p-2 border rounded-lg group hover:bg-muted/50 transition-colors"
            >
              <div className="flex-shrink-0 text-muted-foreground">
                {getFileIcon(attachment.file_type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.file_size)}
                  {attachment.created_at && (
                    <> • {format(new Date(attachment.created_at), "MMM d, yyyy")}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  asChild
                >
                  <a href={attachment.file_url} target="_blank" rel="noopener noreferrer" download>
                    <Download className="h-3 w-3" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(attachment)}
                  disabled={deleteAttachment.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
