
import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { LocalImageService } from "@/services/local-image-service";
import { logger } from "@/lib/logger";

interface LocalImageUploaderProps {
  artworkId: string;
  onUploadComplete?: () => void;
  maxFiles?: number;
  acceptedFileTypes?: string[];
}

interface UploadProgressItem {
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  imageId?: string;
}

export function LocalImageUploader({
  artworkId,
  onUploadComplete,
  maxFiles = 50,
  acceptedFileTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
}: LocalImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressItem[]>([]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    if (!acceptedFileTypes.includes(file.type)) {
      return `${file.name} is not a supported image format. Please use JPG, PNG, WebP, or GIF.`;
    }
    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      return `${file.name} is too large. Maximum file size is 100MB.`;
    }
    if (file.size === 0) {
      return `${file.name} appears to be empty.`;
    }
    return null;
  };

  const handleFiles = useCallback(async (files: FileList) => {
    if (!files.length) return;

    const fileArray = Array.from(files).slice(0, maxFiles);
    
    // Validate all files first
    const validationErrors: string[] = [];
    const validFiles: File[] = [];

    fileArray.forEach(file => {
      const error = validateFile(file);
      if (error) {
        validationErrors.push(error);
      } else {
        validFiles.push(file);
      }
    });

    // Show validation errors
    validationErrors.forEach(error => toast.error(error));

    if (!validFiles.length) {
      toast.error('No valid files to upload');
      return;
    }

    setUploading(true);
    setUploadProgress(validFiles.map(file => ({
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'uploading'
    })));

    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        
        // Update progress to show upload starting
        setUploadProgress(prev => prev.map((item, index) => 
          index === i ? { ...item, progress: 10, status: 'uploading' } : item
        ));

        try {
          const result = await LocalImageService.uploadAndProcessImage(
            file,
            artworkId,
            i === 0 && successCount === 0, // First successful image is primary
            i
          );

          if (result.success) {
            // Update progress to show processing
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
            
            // Show completion after a short delay
            setTimeout(() => {
              setUploadProgress(prev => prev.map((item, index) => 
                index === i ? { ...item, status: 'completed' } : item
              ));
            }, 2000);
            
          } else {
            // Update progress to show error
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
          // Update progress to show error
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
          toast.error(`Failed to upload ${file.name}`);
        }

        // Small delay between uploads to avoid overwhelming the system
        if (i < validFiles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Show summary
      if (successCount > 0) {
        toast.success(
          `${successCount} image(s) uploaded successfully and are being processed`,
          { 
            description: errorCount > 0 ? `${errorCount} uploads failed` : 'Processing will complete in the background'
          }
        );
        onUploadComplete?.();
      }

      if (errorCount === validFiles.length) {
        toast.error(`All uploads failed. Please check your files and try again.`);
      }

    } catch (error) {
      logger.error('[LocalImageUploader] Upload error:', error);
      toast.error('Upload failed unexpectedly. Please try again.');
    } finally {
      setUploading(false);
      
      // Clear progress after a delay, but keep error states longer
      setTimeout(() => {
        setUploadProgress(prev => prev.filter(item => item.status === 'error'));
      }, 5000);
      
      // Clear errors after longer delay
      setTimeout(() => {
        setUploadProgress([]);
      }, 15000);
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
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  }, [handleFiles]);

  const retryUpload = useCallback((index: number) => {
    const progressItem = uploadProgress[index];
    if (!progressItem || progressItem.status !== 'error') return;

    // Create a new FileList-like object with just this file for retry
    toast.info('Please select the file again to retry upload');
    document.getElementById('file-input')?.click();
  }, [uploadProgress]);

  const clearProgress = useCallback(() => {
    setUploadProgress([]);
  }, []);

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
    <div className="w-full space-y-4">
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          ${uploading ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:border-primary hover:bg-muted/25'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && document.getElementById('file-input')?.click()}
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
              Supports JPG, PNG, WebP, GIF up to 100MB each (max {maxFiles} files)
            </p>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Upload Progress</h3>
            {uploadProgress.some(item => item.status === 'error' || item.status === 'completed') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearProgress}
                className="h-auto p-1 text-xs"
              >
                <X className="w-3 h-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
          
          {uploadProgress.map((item, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex-shrink-0">
                {getStatusIcon(item.status)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <span className="text-xs text-muted-foreground ml-2">
                    {formatFileSize(item.size)}
                  </span>
                </div>
                
                {item.status === 'uploading' && (
                  <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                    <div 
                      className="bg-primary h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                
                {item.status === 'processing' && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-blue-600">Processing image...</span>
                  </div>
                )}
                
                {item.status === 'completed' && (
                  <span className="text-xs text-green-600">✓ Upload completed successfully</span>
                )}
                
                {item.status === 'error' && (
                  <div className="mt-1 space-y-1">
                    <span className="text-xs text-red-600 block">✗ {item.error}</span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-red-600 hover:text-red-700"
                      onClick={() => retryUpload(index)}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
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
