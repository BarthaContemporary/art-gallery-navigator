
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Grid3X3, List, Upload, FileText, Folder, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useFolders } from "@/hooks/use-folders";
import { useEnhancedDocuments } from "@/hooks/use-enhanced-documents";
import { FolderBreadcrumb } from "@/components/file-sharing/FolderBreadcrumb";
import { CreateFolderDialog } from "@/components/file-sharing/CreateFolderDialog";
import { FileGridView } from "@/components/file-sharing/FileGridView";
import { EnhancedUploadDocumentDialog } from "@/components/documents/EnhancedUploadDocumentDialog";
import { DocumentsList } from "@/components/documents/DocumentsList";
import { DocumentsSearch } from "@/components/documents/DocumentsSearch";
import { useCurrentUserArtist } from "@/hooks/useCurrentUserArtist";
import { useAuth } from "@/hooks/use-auth";

export default function FileSharing() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
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
      
      {/* Debug information - remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 p-3 bg-gray-100 rounded text-sm">
          <p><strong>Debug Info:</strong></p>
          <p>Folders count: {folders.length}</p>
          <p>Current user artist: {currentUserArtist?.full_name || 'None'}</p>
          <p>Is admin: {isAdmin ? 'Yes' : 'No'}</p>
          <p>Current folder: {currentFolder?.name || 'Root'}</p>
          {foldersError && <p className="text-red-600">Error: {foldersError.message}</p>}
        </div>
      )}
      
      {/* Artist folder navigation for non-admin users */}
      {!isAdmin && currentUserArtist && !currentFolderId && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-medium text-blue-900">Your Files</h3>
                <p className="text-sm text-blue-700">Access your personal file folder</p>
              </div>
            </div>
            <Button onClick={handleNavigateToArtistFolder} variant="outline" size="sm">
              <Folder className="h-4 w-4 mr-2" />
              Open My Folder
            </Button>
          </div>
        </div>
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="files" className="flex items-center gap-2">
            <Folder className="h-4 w-4" />
            Folder View
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            All Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-4">
          {/* Navigation and Controls */}
          <div className="space-y-4">
            <FolderBreadcrumb 
              currentFolder={currentFolder}
              folders={allFolders}
              onNavigate={setCurrentFolderId}
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
                <div className="flex bg-muted rounded-md p-1">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="h-8 w-8 p-0"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="h-8 w-8 p-0"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
                <CreateFolderDialog 
                  parentFolderId={currentFolderId} 
                  artistId={currentFolder?.artist_id || currentUserArtist?.id}
                />
                <EnhancedUploadDocumentDialog />
              </div>
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
            <FileGridView
              folders={filteredFolders}
              documents={filteredDocuments}
              onFolderClick={handleFolderClick}
              onFileClick={handleFileClick}
            />
          )}

          {!isLoading && !foldersError && filteredFolders.length === 0 && filteredDocuments.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📁</div>
              <h3 className="text-lg font-medium mb-2">No files or folders</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "No results found for your search." : "This folder is empty. Create a folder or upload some files to get started."}
              </p>
              {!searchTerm && (isAdmin || currentUserArtist) && (
                <div className="flex gap-2 justify-center">
                  <CreateFolderDialog 
                    parentFolderId={currentFolderId}
                    artistId={currentFolder?.artist_id || currentUserArtist?.id}
                  />
                  <EnhancedUploadDocumentDialog />
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">All Documents</h3>
            <EnhancedUploadDocumentDialog />
          </div>
          
          <DocumentsSearch 
            searchTerm={searchTerm} 
            onSearchChange={setSearchTerm} 
            typeFilter={typeFilter} 
            onTypeFilterChange={setTypeFilter} 
          />

          {filteredAllDocuments.length > 0 ? (
            <DocumentsList documents={filteredAllDocuments} />
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-lg font-medium mb-2">No documents found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || typeFilter ? "Try adjusting your search or filters." : "Upload some documents to get started."}
              </p>
              <EnhancedUploadDocumentDialog />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
