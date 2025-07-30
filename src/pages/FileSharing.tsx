
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key, Cloud, FolderOpen, Share } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/hooks/use-auth";
import { useArtistStorage } from "@/hooks/use-artist-storage";
import { EnhancedIDriveFileManager } from "@/components/file-sharing/EnhancedIDriveFileManager";
import { StorageCredentialsManagement } from "@/components/file-sharing/StorageCredentialsManagement";
import { ArtistStorageInfo } from "@/components/file-sharing/ArtistStorageInfo";

export default function FileSharing() {
  const [activeTab, setActiveTab] = useState("shared-documents");
  const { isAdmin, isArtist } = useAuth();
  const { bucketName, hasCredentials, error: storageError } = useArtistStorage();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader title="FILE MANAGEMENT" />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} mb-6`}>
          <TabsTrigger value="shared-documents" className="flex items-center gap-2 text-xs sm:text-sm">
            <Share className="h-4 w-4" />
            <span className="hidden sm:inline">Shared Documents</span>
            <span className="sm:hidden">Shared</span>
          </TabsTrigger>
          <TabsTrigger value="my-storage" className="flex items-center gap-2 text-xs sm:text-sm">
            <FolderOpen className="h-4 w-4" />
            <span className="hidden sm:inline">My Storage</span>
            <span className="sm:hidden">Storage</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="storage-management" className="flex items-center gap-2 text-xs sm:text-sm">
              <Key className="h-4 w-4" />
              <span className="hidden sm:inline">Storage Management</span>
              <span className="sm:hidden">Manage</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="shared-documents" className="space-y-4">
          <EnhancedIDriveFileManager mode="shared" />
        </TabsContent>

        <TabsContent value="my-storage" className="space-y-4">
          {isArtist ? (
            <ArtistStorageInfo 
              bucketName={bucketName}
              hasCredentials={hasCredentials}
              error={storageError}
            />
          ) : (
            <EnhancedIDriveFileManager mode="personal" />
          )}
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
