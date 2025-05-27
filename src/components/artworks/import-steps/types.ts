
import { ProcessedArtworkForImport, CSVPreviewData, FieldMappings } from "@/components/artworks/ArtworkFieldMapping.types";
import { ReactNode } from "react";

export type ImportStep = "upload" | "mapFields" | "preview" | "importing" | "complete";

export interface ImportStats {
  successful: number;
  failed: number;
  total: number;
}

export interface UseImportCSVProps {
  onCloseDialog: () => void;
}

export interface UseImportCSVReturn {
  currentStep: ImportStep;
  setCurrentStep: React.Dispatch<React.SetStateAction<ImportStep>>;
  file: File | null;
  setFile: React.Dispatch<React.SetStateAction<File | null>>;
  csvPreviewData: CSVPreviewData | null;
  fieldMappings: FieldMappings;
  parsedArtworks: ProcessedArtworkForImport[];
  isProcessingFile: boolean;
  importingProgress: number;
  importStats: ImportStats;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleMappingsChanged: (newMappings: FieldMappings) => void;
  goToPreviewStep: () => void;
  handleImport: () => Promise<void>;
  resetState: () => void;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface UploadStepProps {
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  file: File | null;
  isProcessingFile: boolean;
}

export interface PreviewStepProps {
  parsedArtworks: ProcessedArtworkForImport[];
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

