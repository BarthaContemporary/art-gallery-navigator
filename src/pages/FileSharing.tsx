
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Grid3X3, List, Upload, FileText, Folder } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useFolders } from "@/hooks/use-folders";
import { useEnhancedDocuments } from "@/hooks/use-enhanced-documents";
import { FolderBreadcrumb } from "@/components/file-sharing/FolderBreadcrumb";
import { CreateFolderDialog } from "@/components/file-sharing/CreateFolderDialog";
import { FileGridView } from "@/components/file-sharing/FileGridView";
import { EnhancedUploadDocumentDialog } from "@/components/documents/EnhancedUploadDocumentDialog";
import { DocumentsList } from "@/components/documents/DocumentsList";
import { DocumentsSearch } from "@/components/documents/DocumentsSearch";

export default function FileSharing() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("files");

  const { data: folders = [], isLoading: foldersLoading } = useFolders(currentFolderId);
  const { data: documents = [], isLoading: documentsLoading } = useEnhancedDocuments(currentFolderId);
  const { data: allFolders = [] } = useFolders(); // For breadcrumb navigation
  const { data: allDocuments = [] } = useEnhancedDocuments(); // For documents tab

  const currentFolder = allFolders.find(f => f.id === currentFolderId) || null;

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
    setCurrentFolderId(folderId);
  };

  const handleFileClick = (document: any) => {
    // Open file in new tab or preview
    window.open(document.file_url, '_blank');
  };

  const isLoading = foldersLoading || documentsLoading;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader title="FILE MANAGEMENT" />
      
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
                <CreateFolderDialog parentFolderId={currentFolderId} />
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
          ) : (
            <FileGridView
              folders={filteredFolders}
              documents={filteredDocuments}
              onFolderClick={handleFolderClick}
              onFileClick={handleFileClick}
            />
          )}

          {!isLoading && filteredFolders.length === 0 && filteredDocuments.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📁</div>
              <h3 className="text-lg font-medium mb-2">No files or folders</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "No results found for your search." : "This folder is empty. Create a folder or upload some files to get started."}
              </p>
              {!searchTerm && (
                <div className="flex gap-2 justify-center">
                  <CreateFolderDialog parentFolderId={currentFolderId} />
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
