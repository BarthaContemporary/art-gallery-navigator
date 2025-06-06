import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Wand2, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEnhancedImageProcessing, ImageProcessingOptions } from "@/hooks/use-enhanced-image-processing";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

interface EnhancedImageUploaderProps {
  onImageUploaded: (url: string) => void;
  onProcessingComplete?: (result: any) => void;
}

export function EnhancedImageUploader({ 
  onImageUploaded, 
  onProcessingComplete 
}: EnhancedImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [processingOptions, setProcessingOptions] = useState<ImageProcessingOptions>({
    quality: 90,
    format: 'webp',
    watermark: false,
    sharpen: true,
    autoOrient: true
  });
  const [showOptions, setShowOptions] = useState(false);
  
  const { processImageWithCloudinary } = useEnhancedImageProcessing();

  const uploadAndProcessImage = useCallback(async (file: File) => {
    setIsUploading(true);
    
    try {
      // Upload original image first
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `originals/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('artwork-images')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('artwork-images')
        .getPublicUrl(filePath);

      // Create artwork_images record
      const { data: imageRecord, error: insertError } = await supabase
        .from('artwork_images')
        .insert({
          image_url: publicUrl,
          processed: false
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      onImageUploaded(publicUrl);

      // Process with Cloudinary
      toast.info('Processing image with Cloudinary...', {
        description: 'This may take a few moments'
      });

      const result = await processImageWithCloudinary(
        publicUrl, 
        imageRecord.id, 
        processingOptions
      );

      if (result.success) {
        onProcessingComplete?.(result);
      }

    } catch (error) {
      toast.error("Failed to upload and process image", {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
      console.error("Error uploading image:", error);
    } finally {
      setIsUploading(false);
    }
  }, [onImageUploaded, onProcessingComplete, processImageWithCloudinary, processingOptions]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadAndProcessImage(file);
    }
  }, [uploadAndProcessImage]);

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        id="enhanced-image"
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
        disabled={isUploading}
      />
      
      <Button
        type="button"
        variant="outline"
        onClick={() => document.getElementById("enhanced-image")?.click()}
        disabled={isUploading}
        className="flex-1"
      >
        {isUploading ? (
          <>
            <Wand2 className="mr-2 h-4 w-4 animate-spin" />
            Processing with Cloudinary...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Upload & Process Image
          </>
        )}
      </Button>

      <Dialog open={showOptions} onOpenChange={setShowOptions}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" disabled={isUploading}>
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Image Processing Options</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Quality: {processingOptions.quality}%</Label>
              <Slider
                value={[processingOptions.quality || 90]}
                onValueChange={([value]) => 
                  setProcessingOptions(prev => ({ ...prev, quality: value }))
                }
                max={100}
                min={10}
                step={5}
              />
            </div>

            <div className="space-y-2">
              <Label>Output Format</Label>
              <Select
                value={processingOptions.format}
                onValueChange={(value: 'jpeg' | 'png' | 'webp') =>
                  setProcessingOptions(prev => ({ ...prev, format: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="webp">WebP (Recommended)</SelectItem>
                  <SelectItem value="jpeg">JPEG</SelectItem>
                  <SelectItem value="png">PNG</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="watermark"
                  checked={processingOptions.watermark}
                  onCheckedChange={(checked) =>
                    setProcessingOptions(prev => ({ ...prev, watermark: !!checked }))
                  }
                />
                <Label htmlFor="watermark">Add watermark</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sharpen"
                  checked={processingOptions.sharpen}
                  onCheckedChange={(checked) =>
                    setProcessingOptions(prev => ({ ...prev, sharpen: !!checked }))
                  }
                />
                <Label htmlFor="sharpen">Apply sharpening</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoOrient"
                  checked={processingOptions.autoOrient}
                  onCheckedChange={(checked) =>
                    setProcessingOptions(prev => ({ ...prev, autoOrient: !!checked }))
                  }
                />
                <Label htmlFor="autoOrient">Auto-orient image</Label>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
