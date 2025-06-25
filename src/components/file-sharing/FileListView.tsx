
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface FileListViewProps {
  folders: FolderType[];
  documents: EnhancedDocument[];
  onFolderClick: (folderId: string) => void;
  onFileClick: (document: EnhancedDocument) => void;
}

export function FileListView({ folders, documents, onFolderClick, onFileClick }: FileListViewProps) {
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

  const getItemName = (item: { type: string; data: FolderType | EnhancedDocument }) => {
    return item.type === 'folder' 
      ? (item.data as FolderType).name 
      : (item.data as EnhancedDocument).file_name;
  };

  // Combine folders and documents for unified display
  const allItems = [
    ...folders.map(folder => ({ type: 'folder', data: folder })),
    ...documents.map(document => ({ type: 'document', data: document }))
  ];

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-32">Type</TableHead>
              <TableHead className="w-32">Size</TableHead>
              <TableHead className="w-40">Modified</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allItems.map((item) => (
              <TableRow 
                key={`${item.type}-${item.data.id}`}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => {
                  if (item.type === 'folder') {
                    onFolderClick(item.data.id);
                  } else {
                    onFileClick(item.data as EnhancedDocument);
                  }
                }}
              >
                <TableCell>
                  {item.type === 'folder' ? (
                    <Folder className="h-4 w-4 text-blue-500" />
                  ) : (
                    getFileIcon((item.data as EnhancedDocument).mime_type)
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {getItemName(item)}
                    {item.type === 'document' && (item.data as EnhancedDocument).is_favorite && (
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {item.type === 'folder' ? (
                    <Badge variant="outline">Folder</Badge>
                  ) : (
                    <Badge variant="outline">{(item.data as EnhancedDocument).type}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {item.type === 'folder' ? (
                    '-'
                  ) : (
                    formatFileSize((item.data as EnhancedDocument).file_size)
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(item.data.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={(e) => e.stopPropagation()}
                        className="h-8 w-8 p-0"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {item.type === 'folder' ? (
                        <>
                          <DropdownMenuItem>
                            <Edit3 className="h-4 w-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <ShareDialog folderId={item.data.id} folderName={(item.data as FolderType).name} />
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteDialog({
                                open: true,
                                type: 'folder',
                                id: item.data.id,
                                name: (item.data as FolderType).name
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <>
                          <DropdownMenuItem>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite.mutate({
                                documentId: item.data.id,
                                isFavorite: !(item.data as EnhancedDocument).is_favorite
                              });
                            }}
                          >
                            {(item.data as EnhancedDocument).is_favorite ? (
                              <><StarOff className="h-4 w-4 mr-2" />Remove from favorites</>
                            ) : (
                              <><Star className="h-4 w-4 mr-2" />Add to favorites</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Move className="h-4 w-4 mr-2" />
                            Move
                          </DropdownMenuItem>
                          <ShareDialog fileId={item.data.id} fileName={(item.data as EnhancedDocument).file_name} />
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteDialog({
                                open: true,
                                type: 'file',
                                id: item.data.id,
                                name: (item.data as EnhancedDocument).file_name
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {allItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No files or folders found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
