
import { CSVPreviewData, FieldMappings, ProcessedArtworkForImport, ValidatedProcessedArtwork } from "@/components/artworks/ArtworkFieldMapping.types"; // Added ValidatedProcessedArtwork
import { ReactNode } from "react";

export enum ImportStep {
  UPLOAD = "upload",
  FIELD_MAPPING = "mapFields", 
  PREVIEW = "preview",
  IMPORTING = "importing",
  COMPLETE = "complete"
}

export interface ImportStats {
  successful: number;
  failed: number;
  skipped: number;
  total: number;
}

export interface UseImportCSVProps {
  onCloseDialog: () => void;
}

export interface UseImportCSVReturn {
  open: boolean;
  setOpen: (open: boolean) => void;
  currentStep: ImportStep;
  setCurrentStep: (step: ImportStep) => void;
  file: File | null;
  setFile: (file: File | null) => void;
  csvPreviewData: CSVPreviewData | null;
  fieldMappings: FieldMappings;
  parsedArtworks: ValidatedProcessedArtwork[]; 
  isProcessingFile: boolean;
  importingProgress: number;
  importStats: ImportStats;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleMappingsChanged: (mappings: FieldMappings) => void;
  goToPreviewStep: () => void;
  handleImport: () => Promise<void>;
  resetState: () => void;
  toggleArtworkSelection: (originalRowIndex: number) => void; // Added
  toggleSelectAllArtworks: (selectAll: boolean) => void; // Added
}

export interface UploadStepProps {
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  file: File | null;
  isProcessingFile: boolean;
}

export interface FieldMappingStepProps {
  csvData: CSVPreviewData;
  fieldMapping: FieldMappings;
  onFieldMappingChange: (mappings: FieldMappings) => void;
  onNext: () => void;
  onBack: () => void;
}

export interface PreviewStepProps {
  parsedArtworks: ValidatedProcessedArtwork[]; 
  onImport: () => void;
  onBack: () => void;
  toggleArtworkSelection: (originalRowIndex: number) => void; // Added
  toggleSelectAllArtworks: (selectAll: boolean) => void; // Added
}

export interface ImportingStepProps {
  importingProgress: number;
  importStats: ImportStats;
}

export interface CompleteStepProps {
  importStats: ImportStats;
  onClose: () => void;
}
