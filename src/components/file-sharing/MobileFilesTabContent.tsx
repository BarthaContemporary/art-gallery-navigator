
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { FolderBreadcrumb } from "./FolderBreadcrumb";
import { CreateFolderDialog } from "./CreateFolderDialog";
import { MobileFileListView } from "./MobileFileListView";
import { EnhancedUploadDocumentDialog } from "@/components/documents/EnhancedUploadDocumentDialog";
import { Folder, useFolderAccess } from "@/hooks/use-folders";
import { EnhancedDocument } from "@/hooks/use-enhanced-documents";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MobileFilesTabContentProps {
  currentFolder: Folder | null;
  allFolders: Folder[];
  filteredFolders: Folder[];
  filteredDocuments: EnhancedDocument[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onNavigate: (folderId: string | null) => void;
  onFolderClick: (folderId: string) => void;
  onFileClick: (document: EnhancedDocument) => void;
  isLoading: boolean;
  foldersError: { message: string } | null;
  currentUserArtist: { id: string } | null;
  isAdmin: boolean;
}

export function MobileFilesTabContent({
  currentFolder,
  allFolders,
  filteredFolders,
  filteredDocuments,
  searchTerm,
  setSearchTerm,
  onNavigate,
  onFolderClick,
  onFileClick,
  isLoading,
  foldersError,
  currentUserArtist,
  isAdmin
}: MobileFilesTabContentProps) {
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  
  // Check access to current folder
  const { data: folderAccess } = useFolderAccess(currentFolder?.id || null);
  
  // Determine if user can create content in current location
  const canCreateContent = () => {
    // Admins can always create content
    if (isAdmin) return true;
    
    // If in root (no current folder), user must be an artist
    if (!currentFolder) {
      return !!currentUserArtist;
    }
    
    // If in a folder, check access permissions
    return folderAccess?.can_access ?? false;
  };

  return (
    <div className="space-y-4">
      <FolderBreadcrumb 
        currentFolder={currentFolder}
        folders={allFolders}
        onNavigate={onNavigate}
      />
      
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files and folders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {canCreateContent() && (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCreateFolderOpen(true)}>
                  Create Folder
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setUploadDialogOpen(true)}>
                  Upload File
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading files...</p>
        </div>
      ) : foldersError ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-medium mb-2 text-red-600">Error Loading Folders</h3>
          <p className="text-muted-foreground mb-4 text-sm">{foldersError.message}</p>
          <Button onClick={() => window.location.reload()} size="sm">Reload Page</Button>
        </div>
      ) : (
        <MobileFileListView
          folders={filteredFolders}
          documents={filteredDocuments}
          onFolderClick={onFolderClick}
          onFileClick={onFileClick}
        />
      )}

      {!isLoading && !foldersError && filteredFolders.length === 0 && filteredDocuments.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📁</div>
          <h3 className="text-base font-medium mb-2">No files or folders</h3>
          <p className="text-muted-foreground mb-4 text-sm px-4">
            {searchTerm ? "No results found for your search." : "This folder is empty. Create a folder or upload some files to get started."}
          </p>
          {!searchTerm && canCreateContent() && (
            <div className="flex gap-2 justify-center">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setCreateFolderOpen(true)}
              >
                Create Folder
              </Button>
              <Button 
                size="sm"
                onClick={() => setUploadDialogOpen(true)}
              >
                Upload File
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <CreateFolderDialog 
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        parentFolderId={currentFolder?.id || null} 
        artistId={currentFolder?.artist_id || currentUserArtist?.id}
      />
      
      <EnhancedUploadDocumentDialog 
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />
    </div>
  );
}
