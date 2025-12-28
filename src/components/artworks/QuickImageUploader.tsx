import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, CheckCircle, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LocalImageService } from "@/services/local-image-service";
import { useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";

interface QuickImageUploaderProps {
  onArtworkCreated?: (artworkId: string) => void;
  trigger?: React.ReactNode;
}

export function QuickImageUploader({ onArtworkCreated, trigger }: QuickImageUploaderProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [artworkTitle, setArtworkTitle] = useState("");
  const [createdArtworkId, setCreatedArtworkId] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setUploadedFile(null);
    setPreviewUrl(null);
    setArtworkTitle("");
    setCreatedArtworkId(null);
    setIsUploading(false);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    resetState();
  }, [resetState]);

  const validateFile = (file: File): string | null => {
    const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!acceptedTypes.includes(file.type)) {
      return `${file.name} is not a supported image format. Please use JPG, PNG, WebP, or GIF.`;
    }
    if (file.size > 100 * 1024 * 1024) {
      return `${file.name} is too large. Maximum file size is 100MB.`;
    }
    return null;
  };

  const handleFile = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setUploadedFile(file);
    
    // Generate preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Suggest title from filename
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
    const capitalizedName = nameWithoutExt.charAt(0).toUpperCase() + nameWithoutExt.slice(1);
    setArtworkTitle(capitalizedName);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  const handleSubmit = useCallback(async () => {
    if (!uploadedFile || !artworkTitle.trim()) {
      toast.error("Please provide an image and title");
      return;
    }

    setIsUploading(true);

    try {
      // Step 1: Create the artwork record first
      const { data: artwork, error: artworkError } = await supabase
        .from('artworks')
        .insert({
          title: artworkTitle.trim(),
          classification: 'unique',
          medium_type: 'painting', // Default, can be changed later
          currency: 'GBP',
          status: 'available',
        })
        .select()
        .single();

      if (artworkError) throw artworkError;

      logger.log('[QuickImageUploader] Created artwork:', artwork.id);

      // Step 2: Upload the image linked to this artwork
      const result = await LocalImageService.uploadAndProcessImage(
        uploadedFile,
        artwork.id,
        true, // Is primary
        0
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to upload image');
      }

      setCreatedArtworkId(artwork.id);
      onArtworkCreated?.(artwork.id);

      toast.success("Artwork created!", {
        description: "Would you like to add more details?",
        duration: 8000,
        action: {
          label: "Edit Artwork",
          onClick: () => navigate(`/artworks/${artwork.id}`),
        },
      });

    } catch (error) {
      logger.error('[QuickImageUploader] Error:', error);
      toast.error("Failed to create artwork", {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsUploading(false);
    }
  }, [uploadedFile, artworkTitle, navigate, onArtworkCreated]);

  const handleViewArtwork = useCallback(() => {
    if (createdArtworkId) {
      navigate(`/artworks/${createdArtworkId}`);
      handleClose();
    }
  }, [createdArtworkId, navigate, handleClose]);

  const handleAddAnother = useCallback(() => {
    resetState();
  }, [resetState]);

  return (
    <>
      {trigger ? (
        <div onClick={() => setIsOpen(true)}>{trigger}</div>
      ) : (
        <Button variant="outline" onClick={() => setIsOpen(true)}>
          <ImagePlus className="h-4 w-4 mr-2" />
          Quick Add Artwork
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createdArtworkId ? "Artwork Created!" : "Quick Add Artwork"}
            </DialogTitle>
          </DialogHeader>

          {createdArtworkId ? (
            // Success state
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4 py-6">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <p className="text-center text-muted-foreground">
                  Your artwork has been added to the database. The image is being processed in the background.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleAddAnother}>
                  Add Another
                </Button>
                <Button className="flex-1" onClick={handleViewArtwork}>
                  View Artwork
                </Button>
              </div>
            </div>
          ) : (
            // Upload state
            <div className="space-y-4">
              {!uploadedFile ? (
                // Dropzone
                <div
                  className={`
                    relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                    ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary hover:bg-muted/25'}
                  `}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('quick-upload-input')?.click()}
                >
                  <input
                    id="quick-upload-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Drop image here or click to browse</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        JPG, PNG, WebP, GIF up to 100MB
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                // Preview and title
                <div className="space-y-4">
                  <div className="relative aspect-square max-h-48 mx-auto overflow-hidden rounded-lg bg-muted">
                    {previewUrl && (
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="artwork-title">Artwork Title *</Label>
                    <Input
                      id="artwork-title"
                      value={artworkTitle}
                      onChange={(e) => setArtworkTitle(e.target.value)}
                      placeholder="Enter artwork title"
                      className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      You can add more details after creating the artwork.
                    </p>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                {uploadedFile && (
                  <Button 
                    onClick={handleSubmit} 
                    disabled={isUploading || !artworkTitle.trim()}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Artwork'
                    )}
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}