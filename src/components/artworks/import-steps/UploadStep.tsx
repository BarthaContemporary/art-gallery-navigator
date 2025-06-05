
import React, { useRef } from 'react';
import { Upload, FileText, AlertCircle } from "lucide-react";
import { UploadStepProps } from './types';
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const UploadStep: React.FC<UploadStepProps> = ({ onFileChange, file, isProcessingFile }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): { isValid: boolean; error?: string } => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return { isValid: false, error: "Please select a CSV file" };
    }

    if (file.size > 10 * 1024 * 1024) {
      return { isValid: false, error: "File is too large. Please select a file smaller than 10MB" };
    }

    if (file.size === 0) {
      return { isValid: false, error: "File appears to be empty" };
    }

    return { isValid: true };
  };

  const processFile = (file: File) => {
    const validation = validateFile(file);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    console.log("Processing valid file:", {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Create a proper file input element and trigger the change event
    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInputRef.current.files = dataTransfer.files;
      
      // Create and dispatch a proper change event
      const event = new Event('change', { bubbles: true }) as any;
      Object.defineProperty(event, 'target', {
        value: fileInputRef.current,
        writable: false
      });
      
      // Call the handler directly with the synthetic event
      onFileChange(event);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File input change triggered:", e.target.files);
    
    if (!e.target.files || e.target.files.length === 0) {
      console.log("No files selected");
      return;
    }

    const selectedFile = e.target.files[0];
    const validation = validateFile(selectedFile);
    
    if (!validation.isValid) {
      toast.error(validation.error);
      e.target.value = ''; // Clear the input
      return;
    }

    console.log("File input validation passed, calling onFileChange");
    onFileChange(e);
  };

  const handleDropZoneClick = () => {
    if (!isProcessingFile && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isProcessingFile) {
      toast.warning("Please wait for the current file to finish processing");
      return;
    }

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  return (
    <div className="space-y-4 py-4 px-1">
      <div 
        className="flex items-center justify-center w-full"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div
          onClick={handleDropZoneClick}
          className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isProcessingFile 
              ? 'border-gray-300 bg-gray-50 cursor-not-allowed' 
              : 'border-gray-300 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600'
          }`}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {isProcessingFile ? (
              <>
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-3" />
                <p className="text-md text-primary font-medium">Processing file...</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Please wait</p>
              </>
            ) : (
              <>
                <Upload className="w-10 h-10 mb-3 text-gray-500 dark:text-gray-400" />
                <p className="mb-2 text-md text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">CSV files only (Max 10MB)</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileInputChange}
            disabled={isProcessingFile}
          />
        </div>
      </div>

      {!isProcessingFile && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>CSV Requirements:</strong> Your file should have headers in the first row. 
            Common columns include: title, artist_name, classification, medium_type, price, currency, year, materials.
          </AlertDescription>
        </Alert>
      )}
      
      {file && (
        <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-md">
          <FileText className="h-4 w-4 text-green-600 mr-2" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">Selected file:</p>
            <p className="text-sm text-green-600">{file.name}</p>
            <p className="text-xs text-green-500">
              Size: {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
