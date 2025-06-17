
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Video, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface VideoUploaderProps {
  artworkId?: string;
  onVideoUploaded?: (videoData: any) => void;
  maxFiles?: number;
}

export function VideoUploader({ artworkId, onVideoUploaded, maxFiles = 5 }: VideoUploaderProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: number }>({});

  const uploadVideo = useCallback(async (file: File) => {
    if (!artworkId) {
      toast({
        title: "Error",
        description: "Artwork must be saved before uploading videos",
        variant: "destructive",
      });
      return;
    }

    const fileId = `${file.name}-${Date.now()}`;
    setUploadingFiles(prev => ({ ...prev, [fileId]: 0 }));

    try {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        throw new Error('Please select a video file');
      }

      // Validate file size (100MB limit)
      const maxSize = 100 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error('Video file is too large. Maximum size is 100MB');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${artworkId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload to Supabase storage with progress tracking
      const { error: uploadError, data } = await supabase.storage
        .from('artwork-videos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      setUploadingFiles(prev => ({ ...prev, [fileId]: 50 }));

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('artwork-videos')
        .getPublicUrl(fileName);

      // Save video record to database
      const { error: dbError, data: videoData } = await supabase
        .from('artwork_videos')
        .insert({
          artwork_id: artworkId,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          upload_status: 'pending'
        })
        .select()
        .single();

      if (dbError) {
        throw dbError;
      }

      setUploadingFiles(prev => ({ ...prev, [fileId]: 100 }));

      // Trigger Vimeo upload in background
      try {
        await supabase.functions.invoke('upload-video-to-vimeo', {
          body: { videoId: videoData.id }
        });
      } catch (vimeoError) {
        console.error('Vimeo upload failed:', vimeoError);
        // Don't throw here - the video is still uploaded to our storage
      }

      toast({
        title: "Success",
        description: "Video uploaded successfully. Vimeo processing will happen in the background.",
      });

      if (onVideoUploaded) {
        onVideoUploaded(videoData);
      }

      // Clean up progress after 2 seconds
      setTimeout(() => {
        setUploadingFiles(prev => {
          const { [fileId]: _, ...rest } = prev;
          return rest;
        });
      }, 2000);

    } catch (error: any) {
      console.error("Error uploading video:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload video",
        variant: "destructive",
      });
      
      setUploadingFiles(prev => {
        const { [fileId]: _, ...rest } = prev;
        return rest;
      });
    }
  }, [artworkId, onVideoUploaded, toast]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const videoFiles = files.filter(file => file.type.startsWith('video/'));
    
    if (videoFiles.length === 0) {
      toast({
        title: "Invalid files",
        description: "Please drop video files only",
        variant: "destructive",
      });
      return;
    }

    if (videoFiles.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `Maximum ${maxFiles} videos allowed`,
        variant: "destructive",
      });
      return;
    }

    videoFiles.forEach(uploadVideo);
  }, [uploadVideo, maxFiles, toast]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    files.forEach(uploadVideo);
    event.target.value = ''; // Reset input
  }, [uploadVideo]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const hasUploading = Object.keys(uploadingFiles).length > 0;

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-primary'}
          ${hasUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !hasUploading && document.getElementById("video-upload")?.click()}
      >
        <div className="flex flex-col items-center gap-2">
          <Video className="h-8 w-8 text-gray-400" />
          <p className="text-sm text-gray-600">
            {hasUploading ? 'Uploading...' : 'Drag videos here or click to browse'}
          </p>
          <p className="text-xs text-gray-500">
            MP4, MOV, AVI files up to 100MB
          </p>
        </div>
      </div>

      <input
        type="file"
        id="video-upload"
        className="hidden"
        accept="video/*"
        multiple
        onChange={handleFileChange}
        disabled={hasUploading}
      />

      {/* Upload Progress */}
      {Object.entries(uploadingFiles).map(([fileId, progress]) => (
        <div key={fileId} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate">Uploading video...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      ))}

      {!artworkId && (
        <p className="text-sm text-muted-foreground">
          Save the artwork first to enable video uploads
        </p>
      )}
    </div>
  );
}
