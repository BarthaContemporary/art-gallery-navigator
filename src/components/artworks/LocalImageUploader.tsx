import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { ImageUploadService } from "@/services/image-upload-service";
import { logger } from "@/lib/logger";

interface LocalImageUploaderProps {
  artworkId: string;
  onUploadComplete?: () => void;
  maxFiles?: number;
  acceptedFileTypes?: string[];
}

export function LocalImageUploader({
  artworkId,
  onUploadComplete,
  maxFiles = 10,
  acceptedFileTypes = ['image/jpeg', 'image/png', 'image/webp']
}: LocalImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Array<{
    name: string;
    progress: number;
    status: 'uploading' | 'processing' | 'completed' | 'error';
    error?: string;
    imageId?: string;
  }>>([]);

  const handleFiles = useCallback(async (files: FileList) => {
    if (!files.length) return;

    const fileArray = Array.from(files).slice(0, maxFiles);
    const validFiles = fileArray.filter(file => {
      if (!acceptedFileTypes.includes(file.type)) {
        toast.error(`${file.name} is not a supported image format`);
        return false;
      }
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        toast.error(`${file.name} is too large (max 50MB)`);
        return false;
      }
      return true;
    });

    if (!validFiles.length) return;

    setUploading(true);
    setUploadProgress(validFiles.map(file => ({
      name: file.name,
      progress: 0,
      status: 'uploading'
    })));

    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        
        // Update progress to uploading
        setUploadProgress(prev => prev.map((item, index) => 
          index === i ? { ...item, progress: 10, status: 'uploading' } : item
        ));

        try {
          const result = await ImageUploadService.uploadAndProcessImage(
            file,
            artworkId,
            i === 0, // First image is primary
            i
          );

          if (result.success) {
            // Update progress to processing
            setUploadProgress(prev => prev.map((item, index) => 
              index === i ? { 
                ...item, 
                progress: 100, 
                status: 'processing',
                imageId: result.imageId 
              } : item
            ));
            
            successCount++;
            logger.log(`[LocalImageUploader] Successfully uploaded ${file.name}`);
          } else {
            // Update progress to error
            setUploadProgress(prev => prev.map((item, index) => 
              index === i ? { 
                ...item, 
                progress: 0, 
                status: 'error',
                error: result.error 
              } : item
            ));
            
            errorCount++;
            toast.error(`Failed to upload ${file.name}: ${result.error}`);
          }
        } catch (fileError) {
          // Update progress to error
          setUploadProgress(prev => prev.map((item, index) => 
            index === i ? { 
              ...item, 
              progress: 0, 
              status: 'error',
              error: fileError instanceof Error ? fileError.message : 'Upload failed'
            } : item
          ));
          
          errorCount++;
          logger.error(`[LocalImageUploader] Upload error for ${file.name}:`, fileError);
        }
      }

      // Show summary
      if (successCount > 0) {
        toast.success(
          `${successCount} image(s) uploaded successfully and are being processed`,
          { 
            description: errorCount > 0 ? `${errorCount} uploads failed` : undefined 
          }
        );
        onUploadComplete?.();
      } else if (errorCount > 0) {
        toast.error(`All ${errorCount} uploads failed`);
      }

    } catch (error) {
      logger.error('[LocalImageUploader] Upload error:', error);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      
      // Clear progress after a delay, but keep error states longer
      setTimeout(() => {
        setUploadProgress(prev => prev.filter(item => item.status === 'error'));
      }, 3000);
      
      // Clear errors after longer delay
      setTimeout(() => {
        setUploadProgress([]);
      }, 10000);
    }
  }, [artworkId, maxFiles, acceptedFileTypes, onUploadComplete]);

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
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const retryUpload = useCallback((index: number) => {
    const progressItem = uploadProgress[index];
    if (!progressItem || progressItem.status !== 'error') return;

    // Create a new FileList with just this file (we'll need to re-select it)
    toast.info('Please select the file again to retry upload');
    document.getElementById('file-input')?.click();
  }, [uploadProgress]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          ${uploading ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:border-primary'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept={acceptedFileTypes.join(',')}
          onChange={handleFileInput}
          className="hidden"
          disabled={uploading}
        />

        <div className="flex flex-col items-center gap-4">
          {uploading ? (
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          ) : (
            <Upload className="w-8 h-8 text-muted-foreground" />
          )}
          
          <div>
            <p className="text-lg font-medium">
              {uploading ? 'Uploading images...' : 'Drop images here or click to browse'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Supports JPG, PNG, WebP up to 50MB each (max {maxFiles} files)
            </p>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadProgress.map((item, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex-shrink-0">
                {getStatusIcon(item.status)}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                
                {item.status === 'uploading' && (
                  <div className="w-full bg-muted rounded-full h-2 mt-1">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                
                {item.status === 'processing' && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">Processing image...</span>
                  </div>
                )}
                
                {item.status === 'completed' && (
                  <span className="text-xs text-green-600">✓ Upload completed - processing in background</span>
                )}
                
                {item.status === 'error' && (
                  <div className="mt-1">
                    <span className="text-xs text-red-600 block">✗ {item.error}</span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => retryUpload(index)}
                    >
                      Retry upload
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
