
import React from "react";
import { VideoUploader } from "../VideoUploader";
import { VideoManager } from "../VideoManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface VideoUploadFieldsProps {
  artworkId?: string;
}

export function VideoUploadFields({ artworkId }: VideoUploadFieldsProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Videos</label>
        <p className="text-xs text-muted-foreground mb-4">
          Upload videos that will be automatically synced to Vimeo
        </p>
      </div>

      <Tabs defaultValue={artworkId ? "manage" : "upload"} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload Videos</TabsTrigger>
          <TabsTrigger value="manage" disabled={!artworkId}>
            Manage Videos
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload" className="mt-4">
          <VideoUploader artworkId={artworkId} />
        </TabsContent>
        
        <TabsContent value="manage" className="mt-4">
          {artworkId && <VideoManager artworkId={artworkId} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
