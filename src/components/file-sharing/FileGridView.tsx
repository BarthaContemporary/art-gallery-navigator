
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Folder,
  FileText,
  MoreHorizontal,
  Download,
  Star,
  StarOff,
  Trash2,
  Edit3,
  Move,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { EnhancedDocument, useToggleFavorite, useSoftDeleteDocument } from "@/hooks/use-enhanced-documents";
import { Folder as FolderType, useDeleteFolder } from "@/hooks/use-folders";
import { ShareDialog } from "./ShareDialog";

interface FileGridViewProps {
  folders: FolderType[];
  documents: EnhancedDocument[];
  onFolderClick: (folderId: string) => void;
  onFileClick: (document: EnhancedDocument) => void;
}

export function FileGridView({ folders, documents, onFolderClick, onFileClick }: FileGridViewProps) {
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: 'folder' | 'file'; id: string; name: string }>({
    open: false,
    type: 'folder',
    id: '',
    name: ''
  });

  const toggleFavorite = useToggleFavorite();
  const softDeleteDocument = useSoftDeleteDocument();
  const deleteFolder = useDeleteFolder();

  const handleDelete = async () => {
    if (deleteDialog.type === 'folder') {
      await deleteFolder.mutateAsync(deleteDialog.id);
    } else {
      await softDeleteDocument.mutateAsync(deleteDialog.id);
    }
    setDeleteDialog({ open: false, type: 'folder', id: '', name: '' });
  };

  const getFileIcon = (mimeType?: string | null) => {
    if (!mimeType) return <FileText className="h-8 w-8 text-muted-foreground" />;
    
    if (mimeType.startsWith('image/')) {
      return <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">📷</div>;
    }
    if (mimeType === 'application/pdf') {
      return <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">📄</div>;
    }
    if (mimeType.startsWith('text/')) {
      return <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">📝</div>;
    }
    
    return <FileText className="h-8 w-8 text-muted-foreground" />;
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return 'Unknown size';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Folders */}
        {folders.map((folder) => (
          <Card key={folder.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex flex-col items-center space-y-2">
                <Folder className="h-12 w-12 text-blue-500" />
                <div className="text-center">
                  <p className="text-sm font-medium truncate w-full" title={folder.name}>
                    {folder.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(folder.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFolderClick(folder.id);
                    }}
                    className="flex-1"
                  >
                    Open
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <ShareDialog folderId={folder.id} folderName={folder.name} />
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={() => setDeleteDialog({
                          open: true,
                          type: 'folder',
                          id: folder.id,
                          name: folder.name
                        })}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Files */}
        {documents.map((document) => (
          <Card key={document.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex flex-col items-center space-y-2">
                {getFileIcon(document.mime_type)}
                <div className="text-center w-full">
                  <p className="text-sm font-medium truncate" title={document.file_name}>
                    {document.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(document.file_size)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center space-x-1 w-full">
                  {document.is_favorite && (
                    <Badge variant="secondary" className="text-xs">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {document.type}
                  </Badge>
                </div>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileClick(document);
                    }}
                    className="flex-1"
                  >
                    Open
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => toggleFavorite.mutate({
                          documentId: document.id,
                          isFavorite: !document.is_favorite
                        })}
                      >
                        {document.is_favorite ? (
                          <><StarOff className="h-4 w-4 mr-2" />Remove from favorites</>
                        ) : (
                          <><Star className="h-4 w-4 mr-2" />Add to favorites</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Move className="h-4 w-4 mr-2" />
                        Move
                      </DropdownMenuItem>
                      <ShareDialog fileId={document.id} fileName={document.file_name} />
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={() => setDeleteDialog({
                          open: true,
                          type: 'file',
                          id: document.id,
                          name: document.file_name
                        })}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete "{deleteDialog.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
