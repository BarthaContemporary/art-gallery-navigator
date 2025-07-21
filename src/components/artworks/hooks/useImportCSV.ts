

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseCSVForPreview } from "@/lib/csv/parse-csv-preview";
import { parseMappedCSVToArtworks } from "@/lib/csv/parse-mapped-csv";
import { toast } from "sonner";
import { CSVPreviewData, FieldMappings, ValidatedProcessedArtwork } from "@/components/artworks/ArtworkFieldMapping.types";
import { ImportStep, ImportStats, UseImportCSVReturn } from "@/components/artworks/import-steps/types";
import { performArtworkImport } from './artworkImporter';

export function useImportCSV(initialOpen: boolean = false, onCloseDialog?: () => void): UseImportCSVReturn {
  const [open, setOpen] = useState(initialOpen);
  const [currentStep, setCurrentStep] = useState<ImportStep>(ImportStep.UPLOAD);
  const [file, setFile] = useState<File | null>(null);
  
  const [csvPreviewData, setCsvPreviewData] = useState<CSVPreviewData | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMappings>({});
  const [parsedArtworks, setParsedArtworks] = useState<ValidatedProcessedArtwork[]>([]);
  const [cleanedArtworks, setCleanedArtworks] = useState<ValidatedProcessedArtwork[]>([]);

  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [importingProgress, setImportingProgress] = useState(0);
  const [importStats, setImportStats] = useState<ImportStats>({ successful: 0, failed: 0, skipped: 0, total: 0 });

  const queryClient = useQueryClient();

  const resetState = useCallback(() => {
    console.log("Resetting import state");
    setFile(null);
    setCsvPreviewData(null);
    setFieldMappings({});
    setParsedArtworks([]);
    setCleanedArtworks([]);
    setCurrentStep(ImportStep.UPLOAD);
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
    console.log("File change event triggered in useImportCSV");
    
    if (!e.target.files || e.target.files.length === 0) {
      console.log("No files selected, resetting state");
      resetState();
      return;
    }

    const selectedFile = e.target.files[0];
    console.log("Selected file:", selectedFile.name, "Size:", selectedFile.size, "Type:", selectedFile.type);
    
    setFile(selectedFile);
    setIsProcessingFile(true);

    try {
      console.log("Starting CSV parsing...");
      const previewData = await parseCSVForPreview(selectedFile);
      console.log("CSV parsing successful:", previewData);
      
      setCsvPreviewData(previewData);
      
      // Initialize field mappings
      const initialMappings: FieldMappings = {};
      previewData.headers.forEach(header => {
        initialMappings[header] = null;
      });
      setFieldMappings(initialMappings);
      
      setCurrentStep(ImportStep.FIELD_MAPPING);
      toast.success(`CSV file parsed successfully! Found ${previewData.headers.length} columns and ${previewData.rows.length} rows.`);
    } catch (error: any) {
      console.error("Error parsing CSV for preview:", error);
      toast.error(`Failed to parse CSV: ${error.message || "Please check the file format."}`);
      resetState();
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleMappingsChanged = (newMappings: FieldMappings) => {
    console.log("Field mappings updated:", newMappings);
    setFieldMappings(newMappings);
  };

  const goToPreviewStep = () => {
    console.log("Going to data cleaning step first");
    
    if (!csvPreviewData || !csvPreviewData.rows.length) {
        toast.error("No CSV data available to process.");
        return;
    }

    try {
      console.log("Parsing CSV data to artworks...");
      const validatedArtworks = parseMappedCSVToArtworks(csvPreviewData.rows, fieldMappings);
      console.log("Parsed artworks:", validatedArtworks);
      
      setParsedArtworks(validatedArtworks);
      
      const validToImportCount = validatedArtworks.filter(va => va.isValid && va.isSelectedForImport).length;
      const totalValidCount = validatedArtworks.filter(va => va.isValid).length;
      
      if (validatedArtworks.length === 0) {
          toast.warning("No artworks could be generated with the current mappings. Please check your field mappings or CSV content.");
          return;
      }
      
      if (totalValidCount === 0) {
          toast.warning("No valid artworks found. Please review validation errors and your field mappings.");
          setCurrentStep(ImportStep.DATA_CLEANING);
          return;
      }
      
      if (validToImportCount === 0) {
          toast.warning("No artworks are currently selected for import. Please review selections and validation messages in the next step.");
      } else {
          toast.success(`${totalValidCount} artworks processed, ${validToImportCount} selected for import!`);
      }
      
      setCurrentStep(ImportStep.DATA_CLEANING);
    } catch (error: any) {
      console.error("Error during CSV processing:", error);
      toast.error(`Error processing CSV data: ${error.message || "Unknown error"}`);
    }
  };

  const toggleArtworkSelection = (originalRowIndex: number) => {
    console.log("Toggling artwork selection for row:", originalRowIndex);
    const updateArtworks = (artworks: ValidatedProcessedArtwork[]) =>
      artworks.map(artwork =>
        artwork.originalRowIndex === originalRowIndex
          ? { ...artwork, isSelectedForImport: !artwork.isSelectedForImport }
          : artwork
      );
    
    setParsedArtworks(updateArtworks);
    if (cleanedArtworks.length > 0) {
      setCleanedArtworks(updateArtworks);
    }
  };

  const toggleSelectAllArtworks = (selectAll: boolean) => {
    console.log("Toggling select all artworks:", selectAll);
    const updateArtworks = (artworks: ValidatedProcessedArtwork[]) =>
      artworks.map(artwork =>
        artwork.isValid ? { ...artwork, isSelectedForImport: selectAll } : artwork
      );
    
    setParsedArtworks(updateArtworks);
    if (cleanedArtworks.length > 0) {
      setCleanedArtworks(updateArtworks);
    }
  };
  
  const handleDataCleaningComplete = (cleaned: ValidatedProcessedArtwork[]) => {
    console.log("Data cleaning completed with", cleaned.length, "artworks");
    setCleanedArtworks(cleaned);
    setParsedArtworks(cleaned);
    
    // Provide user feedback
    const selectedCount = cleaned.filter(art => art.isValid && art.isSelectedForImport).length;
    const totalValidCount = cleaned.filter(art => art.isValid).length;
    
    if (selectedCount > 0) {
      toast.success(`Data cleaning complete! ${selectedCount} of ${totalValidCount} valid artworks ready for import.`);
    } else {
      toast.warning("Data cleaning complete, but no artworks are selected for import. Please review and select artworks in the preview step.");
    }
  };

  const handleImport = async () => {
    console.log("Starting import process");
    
    const artworksToImport = cleanedArtworks.length > 0 ? cleanedArtworks : parsedArtworks;
    const artworksToAttemptImport = artworksToImport
      .filter(va => va.isValid && va.isSelectedForImport)
      .map(va => va.artwork);

    if (!artworksToAttemptImport.length) {
      toast.error("No valid artworks selected to import. Please check selections, mappings, and validation messages.");
      return;
    }

    console.log("Importing", artworksToAttemptImport.length, "artworks");
    setCurrentStep(ImportStep.IMPORTING);
    setImportingProgress(0);
    const totalToImport = artworksToAttemptImport.length;
    setImportStats({ successful: 0, failed: 0, skipped: 0, total: 0 });

    try {
      const { successful, failed, skipped } = await performArtworkImport(
        artworksToAttemptImport,
        (progress) => {
          console.log("Import progress:", progress);
          setImportingProgress(progress);
        },
        (stats) => {
          console.log("Import stats update:", stats);
          setImportStats(prevStats => ({
            ...prevStats, 
            successful: stats.successful, 
            failed: stats.failed,
            skipped: stats.skipped
          }));
        }
      );
      
      console.log("Import completed with final stats:", { successful, failed, skipped, total: totalToImport });
      setImportStats({ successful, failed, skipped, total: totalToImport });
      queryClient.invalidateQueries({ queryKey: ["artworks"] });
      setCurrentStep(ImportStep.COMPLETE);
      
      if (successful > 0) {
        toast.success(`Successfully imported ${successful} artwork${successful === 1 ? '' : 's'}!`);
      }
      if (failed > 0) {
        toast.error(`Failed to import ${failed} artwork${failed === 1 ? '' : 's'}.`);
      }
      if (skipped > 0) {
        toast.warning(`Skipped ${skipped} duplicate artwork${skipped === 1 ? '' : 's'}.`);
      }
    } catch (error: any) {
      console.error("Error during import:", error);
      toast.error(`Import failed: ${error.message || "Unknown error"}`);
      setCurrentStep(ImportStep.PREVIEW); // Return to preview on error
    }
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
    toggleArtworkSelection,
    toggleSelectAllArtworks,
    handleDataCleaningComplete,
  };
}
