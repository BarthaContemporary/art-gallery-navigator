
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MultipleImageUploaderProps {
  onImagesUploaded: (urls: string[]) => void;
}

export function MultipleImageUploader({ onImagesUploaded }: MultipleImageUploaderProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const uploadImages = useCallback(async (files: FileList | File[]) => {
    setIsUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = fileName;

        const { error: uploadError, data } = await supabase.storage
          .from('artwork-images')
          .upload(filePath, file);

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('artwork-images')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      onImagesUploaded(uploadedUrls);
      toast({
        title: "Success",
        description: `${uploadedUrls.length} image(s) uploaded successfully`,
      });
    } catch (error) {
      console.error("Error uploading images:", error);
      toast({
        title: "Error",
        description: "Failed to upload images",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [onImagesUploaded, toast]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadImages(files);
    }
  }, [uploadImages]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      uploadImages(files);
    }
  }, [uploadImages]);

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-primary'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && document.getElementById("images")?.click()}
      >
        <div className="flex flex-col items-center gap-2">
          <ImageIcon className="h-8 w-8 text-gray-400" />
          <p className="text-sm text-gray-600">
            {isUploading ? 'Uploading...' : 'Drag images here or click to browse'}
          </p>
        </div>
      </div>
      <input
        type="file"
        id="images"
        className="hidden"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        disabled={isUploading}
      />
    </div>
  );
}
