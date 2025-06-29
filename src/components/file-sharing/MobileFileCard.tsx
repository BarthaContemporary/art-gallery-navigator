
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Folder,
  FileText,
  MoreVertical,
  Download,
  Star,
  StarOff,
  Trash2,
  Edit3,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { EnhancedDocument } from "@/hooks/use-enhanced-documents";
import { Folder as FolderType } from "@/hooks/use-folders";

interface MobileFileCardProps {
  item: { type: 'folder' | 'document'; data: FolderType | EnhancedDocument };
  onFolderClick: (folderId: string) => void;
  onFileClick: (document: EnhancedDocument) => void;
  onDelete: (type: 'folder' | 'file', id: string, name: string) => void;
  onToggleFavorite?: (documentId: string, isFavorite: boolean) => void;
}

export function MobileFileCard({ 
  item, 
  onFolderClick, 
  onFileClick, 
  onDelete,
  onToggleFavorite 
}: MobileFileCardProps) {
  const isFolder = item.type === 'folder';
  const data = item.data;

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const getFileIcon = (mimeType?: string | null) => {
    if (!mimeType) return <FileText className="h-5 w-5 text-muted-foreground" />;
    
    if (mimeType.startsWith('image/')) {
      return <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center text-xs">📷</div>;
    }
    if (mimeType === 'application/pdf') {
      return <div className="w-5 h-5 bg-red-100 rounded flex items-center justify-center text-xs">📄</div>;
    }
    if (mimeType.startsWith('text/')) {
      return <div className="w-5 h-5 bg-green-100 rounded flex items-center justify-center text-xs">📝</div>;
    }
    
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  };

  const handleMainClick = () => {
    if (isFolder) {
      onFolderClick(data.id);
    } else {
      onFileClick(data as EnhancedDocument);
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0" onClick={handleMainClick}>
            {isFolder ? (
              <Folder className="h-6 w-6 text-blue-500" />
            ) : (
              getFileIcon((data as EnhancedDocument).mime_type)
            )}
          </div>
          
          <div className="flex-1 min-w-0" onClick={handleMainClick}>
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {isFolder ? (data as FolderType).name : (data as EnhancedDocument).file_name}
                </h4>
                
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {!isFolder && (
                    <>
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        {(data as EnhancedDocument).type}
                      </Badge>
                      {(data as EnhancedDocument).file_size && (
                        <span className="text-xs text-gray-500">
                          {formatFileSize((data as EnhancedDocument).file_size)}
                        </span>
                      )}
                      {(data as EnhancedDocument).is_favorite && (
                        <Badge variant="secondary" className="text-xs px-1 py-0">
                          <Star className="h-3 w-3 fill-current" />
                        </Badge>
                      )}
                    </>
                  )}
                  
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(data.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isFolder && (
                <>
                  <DropdownMenuItem onClick={() => window.open((data as EnhancedDocument).file_url, '_blank')}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                  {onToggleFavorite && (
                    <DropdownMenuItem
                      onClick={() => onToggleFavorite(
                        data.id, 
                        !(data as EnhancedDocument).is_favorite
                      )}
                    >
                      {(data as EnhancedDocument).is_favorite ? (
                        <><StarOff className="h-4 w-4 mr-2" />Remove from favorites</>
                      ) : (
                        <><Star className="h-4 w-4 mr-2" />Add to favorites</>
                      )}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem>
                <Edit3 className="h-4 w-4 mr-2" />
                {isFolder ? 'Rename' : 'Rename'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-red-600"
                onClick={() => onDelete(
                  isFolder ? 'folder' : 'file',
                  data.id,
                  isFolder ? (data as FolderType).name : (data as EnhancedDocument).file_name
                )}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
