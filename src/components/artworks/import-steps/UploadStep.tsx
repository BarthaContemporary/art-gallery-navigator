
import React from 'react';
import { Upload } from "lucide-react";
import { UploadStepProps } from './types';

export const UploadStep: React.FC<UploadStepProps> = ({ onFileChange, file, isProcessingFile }) => {
  return (
    <div className="space-y-4 py-4 px-1">
      <div className="flex items-center justify-center w-full">
        <label
          htmlFor="csv-file-upload-step" // Changed ID to be unique
          className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-10 h-10 mb-3 text-gray-500 dark:text-gray-400" />
            <p className="mb-2 text-md text-gray-500 dark:text-gray-400">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">CSV files only</p>
            {isProcessingFile && <p className="text-sm text-primary mt-2">Processing file...</p>}
          </div>
          <input
            id="csv-file-upload-step"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={onFileChange}
            disabled={isProcessingFile}
          />
        </label>
      </div>
      {file && <p className="text-sm font-medium">Selected file: {file.name}</p>}
    </div>
  );
};
