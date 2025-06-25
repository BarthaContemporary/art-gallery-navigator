
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Folder,
  MoreHorizontal,
  Download,
  Star,
  StarOff,
  Trash2,
  Edit3,
  Move,
  Share2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { EnhancedDocument, useToggleFavorite } from "@/hooks/use-enhanced-documents";
import { Folder as FolderType } from "@/hooks/use-folders";
import { ShareDialog } from "../ShareDialog";
import { FileIcon } from "./FileIcon";
import { formatFileSize, getItemName } from "../utils/file-utils";

interface FileListTableRowProps {
  item: { type: string; data: FolderType | EnhancedDocument };
  onFolderClick: (folderId: string) => void;
  onFileClick: (document: EnhancedDocument) => void;
  onDelete: (type: 'folder' | 'file', id: string, name: string) => void;
}

export function FileListTableRow({ 
  item, 
  onFolderClick, 
  onFileClick, 
  onDelete 
}: FileListTableRowProps) {
  const toggleFavorite = useToggleFavorite();

  const handleRowClick = () => {
    if (item.type === 'folder') {
      onFolderClick(item.data.id);
    } else {
      onFileClick(item.data as EnhancedDocument);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const type = item.type === 'folder' ? 'folder' : 'file';
    const name = getItemName(item);
    onDelete(type, item.data.id, name);
  };

  return (
    <TableRow 
      className="cursor-pointer hover:bg-muted/50"
      onClick={handleRowClick}
    >
      <TableCell>
        {item.type === 'folder' ? (
          <Folder className="h-4 w-4 text-blue-500" />
        ) : (
          <FileIcon mimeType={(item.data as EnhancedDocument).mime_type} />
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
                <DropdownMenuItem asChild>
                  <div onClick={(e) => e.stopPropagation()}>
                    <ShareDialog 
                      folderId={item.data.id} 
                      folderName={(item.data as FolderType).name} 
                    />
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-red-600"
                  onClick={handleDelete}
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
                <DropdownMenuItem asChild>
                  <div onClick={(e) => e.stopPropagation()}>
                    <ShareDialog 
                      fileId={item.data.id} 
                      fileName={(item.data as EnhancedDocument).file_name} 
                    />
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-red-600"
                  onClick={handleDelete}
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
  );
}
