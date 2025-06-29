
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { FolderBreadcrumb } from "./FolderBreadcrumb";
import { CreateFolderDialog } from "./CreateFolderDialog";
import { FileListView } from "./FileListView";
import { MobileFilesTabContent } from "./MobileFilesTabContent";
import { EnhancedUploadDocumentDialog } from "@/components/documents/EnhancedUploadDocumentDialog";
import { Folder, useFolderAccess } from "@/hooks/use-folders";
import { EnhancedDocument } from "@/hooks/use-enhanced-documents";
import { useIsMobile } from "@/hooks/use-mobile";

interface FilesTabContentProps {
  currentFolder: Folder | null;
  allFolders: Folder[];
  filteredFolders: Folder[];
  filteredDocuments: EnhancedDocument[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  onNavigate: (folderId: string | null) => void;
  onFolderClick: (folderId: string) => void;
  onFileClick: (document: EnhancedDocument) => void;
  isLoading: boolean;
  foldersError: { message: string } | null;
  currentUserArtist: { id: string } | null;
  isAdmin: boolean;
}

export function FilesTabContent({
  currentFolder,
  allFolders,
  filteredFolders,
  filteredDocuments,
  searchTerm,
  setSearchTerm,
  sortBy,
  setSortBy,
  onNavigate,
  onFolderClick,
  onFileClick,
  isLoading,
  foldersError,
  currentUserArtist,
  isAdmin
}: FilesTabContentProps) {
  const isMobile = useIsMobile();
  
  // Use mobile version on mobile devices
  if (isMobile) {
    return (
      <MobileFilesTabContent
        currentFolder={currentFolder}
        allFolders={allFolders}
        filteredFolders={filteredFolders}
        filteredDocuments={filteredDocuments}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onNavigate={onNavigate}
        onFolderClick={onFolderClick}
        onFileClick={onFileClick}
        isLoading={isLoading}
        foldersError={foldersError}
        currentUserArtist={currentUserArtist}
        isAdmin={isAdmin}
      />
    );
  }

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
      
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files and folders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="date">Date modified</SelectItem>
              <SelectItem value="size">Size</SelectItem>
              <SelectItem value="type">Type</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-2">
          {canCreateContent() && (
            <>
              <CreateFolderDialog 
                parentFolderId={currentFolder?.id || null} 
                artistId={currentFolder?.artist_id || currentUserArtist?.id}
              />
              <EnhancedUploadDocumentDialog />
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading files...</p>
        </div>
      ) : foldersError ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-lg font-medium mb-2 text-red-600">Error Loading Folders</h3>
          <p className="text-muted-foreground mb-4">{foldersError.message}</p>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      ) : (
        <FileListView
          folders={filteredFolders}
          documents={filteredDocuments}
          onFolderClick={onFolderClick}
          onFileClick={onFileClick}
        />
      )}

      {!isLoading && !foldersError && filteredFolders.length === 0 && filteredDocuments.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📁</div>
          <h3 className="text-lg font-medium mb-2">No files or folders</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm ? "No results found for your search." : "This folder is empty. Create a folder or upload some files to get started."}
          </p>
          {!searchTerm && canCreateContent() && (
            <div className="flex gap-2 justify-center">
              <CreateFolderDialog 
                parentFolderId={currentFolder?.id || null}
                artistId={currentFolder?.artist_id || currentUserArtist?.id}
              />
              <EnhancedUploadDocumentDialog />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
