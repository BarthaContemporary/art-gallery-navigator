import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseCSVForPreview, parseMappedCSVToArtworks } from "@/lib/csv";
import { toast } from "sonner";
import { CSVPreviewData, FieldMappings, ProcessedArtworkForImport, ValidatedProcessedArtwork } from "@/components/artworks/ArtworkFieldMapping.types";
import { ImportStep, ImportStats, UseImportCSVReturn } from "@/components/artworks/import-steps/types";
import { performArtworkImport } from './artworkImporter';

export function useImportCSV(initialOpen: boolean = false, onCloseDialog?: () => void): UseImportCSVReturn {
  const [open, setOpen] = useState(initialOpen);
  const [currentStep, setCurrentStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  
  const [csvPreviewData, setCsvPreviewData] = useState<CSVPreviewData | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMappings>({});
  const [parsedArtworks, setParsedArtworks] = useState<ValidatedProcessedArtwork[]>([]);

  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [importingProgress, setImportingProgress] = useState(0);
  const [importStats, setImportStats] = useState<ImportStats>({ successful: 0, failed: 0, skipped: 0, total: 0 });

  const queryClient = useQueryClient();

  const resetState = useCallback(() => {
    setFile(null);
    setCsvPreviewData(null);
    setFieldMappings({});
    setParsedArtworks([]);
    setCurrentStep("upload");
    setIsProcessingFile(false);
    setImportingProgress(0);
    setImportStats({ successful: 0, failed: 0, skipped: 0, total: 0 });
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
      if (onCloseDialog) onCloseDialog();
    }
  }, [open, resetState, onCloseDialog]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      resetState();
      return;
    }

    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setIsProcessingFile(true);

    try {
      const previewData = await parseCSVForPreview(selectedFile);
      setCsvPreviewData(previewData);
      const initialMappings: FieldMappings = {};
      previewData.headers.forEach(header => {
        initialMappings[header] = null;
      });
      setFieldMappings(initialMappings);
      setCurrentStep("mapFields");
    } catch (error: any) {
      console.error("Error parsing CSV for preview:", error);
      toast.error(`Failed to parse CSV: ${error.message || "Please check format."}`);
      resetState();
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleMappingsChanged = (newMappings: FieldMappings) => {
    setFieldMappings(newMappings);
  };

  const goToPreviewStep = () => {
    if (!csvPreviewData || !csvPreviewData.rows.length) {
        toast.error("No CSV data available to preview.");
        return;
    }
    const validatedArtworks = parseMappedCSVToArtworks(csvPreviewData.rows, fieldMappings);
    setParsedArtworks(validatedArtworks);
    
    const validToImportCount = validatedArtworks.filter(va => va.isValid && va.isSelectedForImport).length;
    if (validToImportCount === 0 && validatedArtworks.length > 0) {
        const anyValid = validatedArtworks.some(va => va.isValid);
        if (anyValid) {
            toast.warning("No artworks are currently selected for import, or none could be confidently prepared. Please review selections, warnings/errors and your field mappings.");
        } else {
            toast.warning("No artworks could be confidently prepared for import. Please review warnings/errors and your field mappings.");
        }
    } else if (validatedArtworks.length === 0) {
        toast.warning("No artworks could be generated with the current mappings. Please check your field mappings or CSV content.");
    }
    setCurrentStep("preview");
  };

  const toggleArtworkSelection = (originalRowIndex: number) => {
    setParsedArtworks(prevArtworks =>
      prevArtworks.map(artwork =>
        artwork.originalRowIndex === originalRowIndex
          ? { ...artwork, isSelectedForImport: !artwork.isSelectedForImport }
          : artwork
      )
    );
  };

  const toggleSelectAllArtworks = (selectAll: boolean) => {
    setParsedArtworks(prevArtworks =>
      prevArtworks.map(artwork =>
        artwork.isValid ? { ...artwork, isSelectedForImport: selectAll } : artwork
      )
    );
  };
  
  const handleImport = async () => {
    const artworksToAttemptImport = parsedArtworks
      .filter(va => va.isValid && va.isSelectedForImport) // Only import valid AND selected artworks
      .map(va => va.artwork);

    if (!artworksToAttemptImport.length) {
      toast.error("No valid artworks selected to import. Please check selections, mappings, CSV data, and any validation messages.");
      return;
    }

    setCurrentStep("importing");
    setImportingProgress(0);
    const totalToImport = artworksToAttemptImport.length;
    setImportStats({ successful: 0, failed: 0, skipped: 0, total: totalToImport });

    const { successful, failed, skipped } = await performArtworkImport(
      artworksToAttemptImport,
      (progress) => setImportingProgress(progress),
      (stats) => setImportStats(prevStats => ({
        ...prevStats, 
        successful: stats.successful, 
        failed: stats.failed,
        skipped: stats.skipped
      }))
    );
    
    setImportStats({ successful, failed, skipped, total: totalToImport });
    queryClient.invalidateQueries({ queryKey: ["artworks"] });
    setCurrentStep("complete");
  };

  return {
    open,
    setOpen,
    currentStep,
    setCurrentStep,
    file,
    setFile,
    csvPreviewData,
    fieldMappings,
    parsedArtworks,
    isProcessingFile,
    importingProgress,
    importStats,
    handleFileChange,
    handleMappingsChanged,
    goToPreviewStep,
    handleImport,
    resetState,
    toggleArtworkSelection, // Expose new function
    toggleSelectAllArtworks, // Expose new function
  };
}
