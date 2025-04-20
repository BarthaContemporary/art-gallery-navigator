
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ImageUploaderProps {
  onImageUploaded: (url: string) => void;
}

export function ImageUploader({ onImageUploaded }: ImageUploaderProps) {
  const { toast } = useToast();

  const uploadImage = useCallback(async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('artwork-images')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('artwork-images')
        .getPublicUrl(filePath);

      onImageUploaded(publicUrl);
      
      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
      console.error("Error uploading image:", error);
    }
  }, [onImageUploaded, toast]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadImage(file);
    }
  }, [uploadImage]);

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        id="image"
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => document.getElementById("image")?.click()}
      >
        <Upload className="mr-2 h-4 w-4" />
        Upload Image
      </Button>
    </div>
  );
}
