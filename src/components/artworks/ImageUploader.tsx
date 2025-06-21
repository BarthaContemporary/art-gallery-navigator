
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LocalImageService } from "@/services/local-image-service";

interface ImageUploaderProps {
  artworkId?: string;
  onImageUploaded: (url: string) => void;
}

export function ImageUploader({ artworkId, onImageUploaded }: ImageUploaderProps) {
  const { toast } = useToast();

  const uploadImage = useCallback(async (file: File) => {
    try {
      if (!artworkId) {
        // Fallback for non-artwork uploads - use simple storage upload
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
      } else {
        // Use LocalImageService for artwork images to save originals
        const result = await LocalImageService.uploadAndProcessImage(
          file,
          artworkId,
          false, // not primary by default
          0 // default display order
        );

        if (result.success && result.imageId) {
          // Return a placeholder URL since actual URLs will be set during processing
          onImageUploaded('processing');
          
          toast({
            title: "Success",
            description: "Image uploaded and is being processed",
          });
        } else {
          throw new Error(result.error || 'Upload failed');
        }
      }
      
      if (!artworkId) {
        toast({
          title: "Success",
          description: "Image uploaded successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
      console.error("Error uploading image:", error);
    }
  }, [onImageUploaded, toast, artworkId]);

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
