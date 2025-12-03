
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EnhancedDocument, useSoftDeleteDocument } from "@/hooks/use-enhanced-documents";
import { Folder as FolderType, useDeleteFolder } from "@/hooks/use-folders";
import { FileListTableRow } from "./components/FileListTableRow";
import { DeleteConfirmationDialog } from "./components/DeleteConfirmationDialog";

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

  const handleDeleteRequest = (type: 'folder' | 'file', id: string, name: string) => {
    setDeleteDialog({ open: true, type, id, name });
  };

  // Combine folders and documents for unified display
  const allItems = [
    ...folders.map(folder => ({ type: 'folder', data: folder })),
    ...documents.map(document => ({ type: 'document', data: document }))
  ];

  return (
    <>
      <div className="border">
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
              <FileListTableRow
                key={`${item.type}-${item.data.id}`}
                item={item}
                onFolderClick={onFolderClick}
                onFileClick={onFileClick}
                onDelete={handleDeleteRequest}
              />
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

      <DeleteConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        itemName={deleteDialog.name}
        onConfirm={handleDelete}
      />
    </>
  );
}
