
import { useState } from "react";
import { EnhancedDocument, useToggleFavorite, useSoftDeleteDocument } from "@/hooks/use-enhanced-documents";
import { Folder as FolderType, useDeleteFolder } from "@/hooks/use-folders";
import { MobileFileCard } from "./MobileFileCard";
import { DeleteConfirmationDialog } from "./components/DeleteConfirmationDialog";

interface MobileFileListViewProps {
  folders: FolderType[];
  documents: EnhancedDocument[];
  onFolderClick: (folderId: string) => void;
  onFileClick: (document: EnhancedDocument) => void;
}

export function MobileFileListView({ folders, documents, onFolderClick, onFileClick }: MobileFileListViewProps) {
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

  const handleDeleteRequest = (type: 'folder' | 'file', id: string, name: string) => {
    setDeleteDialog({ open: true, type, id, name });
  };

  const handleToggleFavorite = (documentId: string, isFavorite: boolean) => {
    toggleFavorite.mutate({ documentId, isFavorite });
  };

  // Combine folders and documents for unified display
  const allItems = [
    ...folders.map(folder => ({ type: 'folder' as const, data: folder })),
    ...documents.map(document => ({ type: 'document' as const, data: document }))
  ];

  return (
    <>
      <div className="space-y-3">
        {allItems.map((item) => (
          <MobileFileCard
            key={`${item.type}-${item.data.id}`}
            item={item}
            onFolderClick={onFolderClick}
            onFileClick={onFileClick}
            onDelete={handleDeleteRequest}
            onToggleFavorite={handleToggleFavorite}
          />
        ))}
        {allItems.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-4xl mb-4">📁</div>
            <p className="text-sm">No files or folders found</p>
          </div>
        )}
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
