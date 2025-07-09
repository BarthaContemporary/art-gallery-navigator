
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key, Cloud } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/hooks/use-auth";
import { EnhancedIDriveFileManager } from "@/components/file-sharing/EnhancedIDriveFileManager";
import { StorageCredentialsManagement } from "@/components/file-sharing/StorageCredentialsManagement";

export default function FileSharing() {
  const [activeTab, setActiveTab] = useState("storage");
  const { isAdmin } = useAuth();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader title="FILE MANAGEMENT" />
      
      {isAdmin ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="storage" className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              Cloud Storage
            </TabsTrigger>
            <TabsTrigger value="storage-management" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Storage Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="storage" className="space-y-4">
            <EnhancedIDriveFileManager />
          </TabsContent>

          <TabsContent value="storage-management" className="space-y-4">
            <StorageCredentialsManagement />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-4">
          <EnhancedIDriveFileManager />
        </div>
      )}
    </div>
  );
}
