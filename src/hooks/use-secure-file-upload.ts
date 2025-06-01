
import { useState, useCallback } from 'react';
import { InputValidator } from '@/utils/input-validation';
import { toast } from 'sonner';

interface UploadResult {
  success: boolean;
  fileUrl?: string;
  error?: string;
}

export function useSecureFileUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = useCallback(async (
    file: File,
    allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSize: number = 10 * 1024 * 1024 // 10MB default
  ): Promise<UploadResult> => {
    // Validate file
    const validation = InputValidator.validateFile(file, allowedTypes, maxSize);
    if (!validation.isValid) {
      toast.error(validation.errors[0]);
      return { success: false, error: validation.errors[0] };
    }

    // Check file content (basic magic number validation)
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    // Basic file type validation by magic numbers
    if (file.type.startsWith('image/')) {
      const isValidImage = validateImageFile(bytes, file.type);
      if (!isValidImage) {
        toast.error('Invalid image file format');
        return { success: false, error: 'Invalid image file' };
      }
    }

    setIsUploading(true);
    
    try {
      // Create FormData for upload
      const formData = new FormData();
      formData.append('file', file);
      
      // Add security headers and metadata
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.fileUrl) {
        toast.success('File uploaded successfully');
        return { success: true, fileUrl: result.fileUrl };
      } else {
        throw new Error('No file URL returned');
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsUploading(false);
    }
  }, []);

  return {
    uploadFile,
    isUploading,
  };
}

// Validate image files by checking magic numbers
function validateImageFile(bytes: Uint8Array, mimeType: string): boolean {
  // JPEG
  if (mimeType === 'image/jpeg') {
    return bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
  }
  
  // PNG
  if (mimeType === 'image/png') {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
  }
  
  // WebP
  if (mimeType === 'image/webp') {
    return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  }
  
  return false;
}
