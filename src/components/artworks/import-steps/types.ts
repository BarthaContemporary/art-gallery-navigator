
import { CSVPreviewData, FieldMappings, ProcessedArtworkForImport, ValidatedProcessedArtwork } from "@/components/artworks/ArtworkFieldMapping.types"; // Added ValidatedProcessedArtwork
import { ReactNode } from "react";

export type ImportStep = "upload" | "mapFields" | "preview" | "importing" | "complete";

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
  parsedArtworks: ValidatedProcessedArtwork[]; // Changed type here
  isProcessingFile: boolean;
  importingProgress: number;
  importStats: ImportStats;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleMappingsChanged: (mappings: FieldMappings) => void;
  goToPreviewStep: () => void;
  handleImport: () => Promise<void>;
  resetState: () => void;
}

export interface UploadStepProps {
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  file: File | null;
  isProcessingFile: boolean;
}

export interface PreviewStepProps {
  parsedArtworks: ValidatedProcessedArtwork[]; // Changed type here
  onImport: () => void;
  onBack: () => void;
}

export interface ImportingStepProps {
  importingProgress: number;
  importStats: ImportStats;
}

export interface CompleteStepProps {
  importStats: ImportStats;
  onClose: () => void;
}
