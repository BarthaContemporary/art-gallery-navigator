
import { useState, useCallback } from 'react';
import { EnhancedInputValidator } from '@/utils/enhanced-input-validation';
import { toast } from 'sonner';

interface UploadResult {
  success: boolean;
  fileUrl?: string;
  error?: string;
}

interface VirusScanResult {
  isClean: boolean;
  threat?: string;
}

export function useEnhancedSecureFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Enhanced file validation with magic number checking
  const validateFileContent = async (file: File): Promise<boolean> => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    // Check magic numbers for file type validation
    if (file.type.startsWith('image/')) {
      return validateImageMagicNumbers(bytes, file.type);
    }
    
    if (file.type === 'application/pdf') {
      return validatePDFMagicNumbers(bytes);
    }
    
    return true; // Allow other file types for now
  };

  const validateImageMagicNumbers = (bytes: Uint8Array, mimeType: string): boolean => {
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
    
    // GIF
    if (mimeType === 'image/gif') {
      return (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) &&
             (bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39));
    }
    
    return false;
  };

  const validatePDFMagicNumbers = (bytes: Uint8Array): boolean => {
    // PDF starts with %PDF-
    const pdfHeader = [0x25, 0x50, 0x44, 0x46, 0x2D];
    return pdfHeader.every((byte, index) => bytes[index] === byte);
  };

  // Basic virus scan simulation (in production, use a real scanning service)
  const performVirusScan = async (file: File): Promise<VirusScanResult> => {
    // Simulate virus scanning delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check for suspicious file names or extensions
    const suspiciousExtensions = ['.exe', '.bat', '.com', '.scr', '.pif', '.cmd'];
    const suspiciousNames = ['autorun.inf', 'desktop.ini'];
    
    const fileName = file.name.toLowerCase();
    
    if (suspiciousExtensions.some(ext => fileName.endsWith(ext))) {
      return { isClean: false, threat: 'Executable file detected' };
    }
    
    if (suspiciousNames.includes(fileName)) {
      return { isClean: false, threat: 'Suspicious system file detected' };
    }
    
    // In production, integrate with a real virus scanning API
    return { isClean: true };
  };

  const uploadFile = useCallback(async (
    file: File,
    allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSize: number = 10 * 1024 * 1024 // 10MB default
  ): Promise<UploadResult> => {
    setUploadProgress(0);

    // Rate limiting check
    if (!EnhancedInputValidator.checkRateLimit('file_upload', 10, 60 * 1000)) {
      toast.error('Too many upload attempts. Please wait a moment.');
      return { success: false, error: 'Rate limit exceeded' };
    }

    // Basic file validation
    const validation = EnhancedInputValidator.validateFile(file, allowedTypes, maxSize);
    if (!validation.isValid) {
      toast.error(validation.errors[0]);
      return { success: false, error: validation.errors[0] };
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      // Content validation
      const isValidContent = await validateFileContent(file);
      if (!isValidContent) {
        toast.error('File content does not match the file type');
        return { success: false, error: 'Invalid file content' };
      }
      
      setUploadProgress(30);

      // Virus scanning
      const virusScanResult = await performVirusScan(file);
      if (!virusScanResult.isClean) {
        toast.error(`Security threat detected: ${virusScanResult.threat}`);
        return { success: false, error: 'Security threat detected' };
      }

      setUploadProgress(50);

      // Generate secure filename
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const secureFileName = `upload_${timestamp}_${randomSuffix}.${fileExtension}`;

      // Create FormData with security headers
      const formData = new FormData();
      formData.append('file', new File([file], secureFileName, { type: file.type }));
      formData.append('checksum', await calculateFileChecksum(file));
      formData.append('originalName', EnhancedInputValidator.sanitizeInput(file.name));

      setUploadProgress(70);

      // Upload with enhanced security
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
      });

      setUploadProgress(90);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      if (result.fileUrl) {
        setUploadProgress(100);
        toast.success('File uploaded successfully');
        return { success: true, fileUrl: result.fileUrl };
      } else {
        throw new Error('No file URL returned from server');
      }
    } catch (error) {
      console.error('Enhanced upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      toast.error(`Upload failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, []);

  // Calculate file checksum for integrity verification
  const calculateFileChecksum = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  return {
    uploadFile,
    isUploading,
    uploadProgress,
  };
}
