
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Key, Cloud } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/hooks/use-auth";
import { DocumentsTabContent } from "@/components/file-sharing/DocumentsTabContent";
import { EnhancedIDriveFileManager } from "@/components/file-sharing/EnhancedIDriveFileManager";
import { StorageCredentialsManagement } from "@/components/file-sharing/StorageCredentialsManagement";

export default function FileSharing() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("documents");

  const { isAdmin } = useAuth();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader title="FILE MANAGEMENT" />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} mb-6`}>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            All Documents
          </TabsTrigger>
          <TabsTrigger value="storage" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Cloud Storage
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="storage-management" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Storage Management
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <DocumentsTabContent
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        </TabsContent>

        <TabsContent value="storage" className="space-y-4">
          <EnhancedIDriveFileManager />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="storage-management" className="space-y-4">
            <StorageCredentialsManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
