
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Folder, Users, Key } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useFolders } from "@/hooks/use-folders";
import { useEnhancedDocuments } from "@/hooks/use-enhanced-documents";
import { useCurrentUserArtist } from "@/hooks/useCurrentUserArtist";
import { useAuth } from "@/hooks/use-auth";
import { ArtistFolderNavigation } from "@/components/file-sharing/ArtistFolderNavigation";
import { FileManagementDebugPanel } from "@/components/file-sharing/FileManagementDebugPanel";
import { FilesTabContent } from "@/components/file-sharing/FilesTabContent";
import { DocumentsTabContent } from "@/components/file-sharing/DocumentsTabContent";
import { ArtistFolderManagement } from "@/components/file-sharing/ArtistFolderManagement";
import { WebDAVTokenManager } from "@/components/file-sharing/WebDAVTokenManager";

export default function FileSharing() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("files");

  const currentUserArtist = useCurrentUserArtist();
  const { isAdmin } = useAuth();

  const { data: folders = [], isLoading: foldersLoading, error: foldersError } = useFolders(currentFolderId);
  const { data: documents = [], isLoading: documentsLoading } = useEnhancedDocuments(currentFolderId);
  const { data: allFolders = [] } = useFolders(); // For breadcrumb navigation
  const { data: allDocuments = [] } = useEnhancedDocuments(); // For documents tab

  // Add debugging
  console.log("FileSharing - Current folders:", folders);
  console.log("FileSharing - Current user artist:", currentUserArtist);
  console.log("FileSharing - Is admin:", isAdmin);
  console.log("FileSharing - Current folder ID:", currentFolderId);
  console.log("FileSharing - Folders error:", foldersError);

  const currentFolder = allFolders.find(f => f.id === currentFolderId) || null;

  // Filter folders and documents based on search
  const filteredDocuments = documents.filter(doc =>
    doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter all documents for the documents tab
  const filteredAllDocuments = allDocuments.filter(doc => {
    const matchesSearch = doc.file_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !typeFilter || doc.type.toLowerCase() === typeFilter.toLowerCase();
    return matchesSearch && matchesType;
  });

  const handleFolderClick = (folderId: string) => {
    console.log("Navigating to folder:", folderId);
    setCurrentFolderId(folderId);
  };

  const handleFileClick = (document: any) => {
    // Open file in new tab or preview
    window.open(document.file_url, '_blank');
  };

  // Navigate to artist's root folder on first load if they're an artist
  const handleNavigateToArtistFolder = () => {
    if (currentUserArtist) {
      const artistFolder = allFolders.find(f => f.artist_id === currentUserArtist.id && f.parent_folder_id === null);
      console.log("Artist folder found:", artistFolder);
      if (artistFolder) {
        setCurrentFolderId(artistFolder.id);
      }
    }
  };

  const isLoading = foldersLoading || documentsLoading;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader title="FILE MANAGEMENT" />
      
      <FileManagementDebugPanel
        foldersCount={folders.length}
        currentUserArtist={currentUserArtist}
        isAdmin={isAdmin}
        currentFolderName={currentFolder?.name || null}
        foldersError={foldersError}
      />
      
      {/* Artist folder navigation for non-admin users */}
      {!isAdmin && currentUserArtist && !currentFolderId && (
        <ArtistFolderNavigation onNavigateToArtistFolder={handleNavigateToArtistFolder} />
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'} mb-6`}>
          <TabsTrigger value="files" className="flex items-center gap-2">
            <Folder className="h-4 w-4" />
            Folder View
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            All Documents
          </TabsTrigger>
          <TabsTrigger value="webdav" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            WebDAV Access
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="artist-management" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Artist Management
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="files" className="space-y-4">
          <FilesTabContent
            currentFolder={currentFolder}
            allFolders={allFolders}
            filteredFolders={filteredFolders}
            filteredDocuments={filteredDocuments}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            sortBy={sortBy}
            setSortBy={setSortBy}
            onNavigate={setCurrentFolderId}
            onFolderClick={handleFolderClick}
            onFileClick={handleFileClick}
            isLoading={isLoading}
            foldersError={foldersError}
            currentUserArtist={currentUserArtist}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <DocumentsTabContent
            filteredAllDocuments={filteredAllDocuments}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
          />
        </TabsContent>

        <TabsContent value="webdav" className="space-y-4">
          <WebDAVTokenManager />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="artist-management" className="space-y-4">
            <ArtistFolderManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
