
import React, { useRef } from 'react';
import { Upload, FileText } from "lucide-react";
import { UploadStepProps } from './types';
import { toast } from "sonner";

export const UploadStep: React.FC<UploadStepProps> = ({ onFileChange, file, isProcessingFile }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File input change triggered:", e.target.files);
    
    if (!e.target.files || e.target.files.length === 0) {
      console.log("No files selected");
      return;
    }

    const selectedFile = e.target.files[0];
    console.log("File selected:", {
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type
    });

    // Validate file type
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast.error("Please select a CSV file");
      e.target.value = ''; // Clear the input
      return;
    }

    // Validate file size (10MB limit)
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File is too large. Please select a file smaller than 10MB");
      e.target.value = ''; // Clear the input
      return;
    }

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
    
    if (isProcessingFile) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      
      // Create a synthetic event to mimic file input change
      const syntheticEvent = {
        target: { files: [file] }
      } as React.ChangeEvent<HTMLInputElement>;
      
      handleFileInputChange(syntheticEvent);
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
          className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
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
