
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
    console.log("Resetting import state");
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
    console.log("File change event triggered in useImportCSV");
    
    if (!e.target.files || e.target.files.length === 0) {
      console.log("No files selected, resetting state");
      resetState();
      return;
    }

    const selectedFile = e.target.files[0];
    console.log("Selected file:", selectedFile.name, "Size:", selectedFile.size, "Type:", selectedFile.type);
    
    // File validation is now handled in UploadStep component
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
      
      setCurrentStep("mapFields");
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
    console.log("Going to preview step");
    
    if (!csvPreviewData || !csvPreviewData.rows.length) {
        toast.error("No CSV data available to preview.");
        return;
    }

    try {
      console.log("Parsing CSV data to artworks...");
      const validatedArtworks = parseMappedCSVToArtworks(csvPreviewData.rows, fieldMappings);
      console.log("Parsed artworks:", validatedArtworks);
      
      setParsedArtworks(validatedArtworks);
      
      const validToImportCount = validatedArtworks.filter(va => va.isValid && va.isSelectedForImport).length;
      if (validToImportCount === 0 && validatedArtworks.length > 0) {
          const anyValid = validatedArtworks.some(va => va.isValid);
          if (anyValid) {
              toast.warning("No artworks are currently selected for import. Please review selections and validation messages.");
          } else {
              toast.warning("No artworks could be prepared for import. Please review validation errors and your field mappings.");
          }
      } else if (validatedArtworks.length === 0) {
          toast.warning("No artworks could be generated with the current mappings. Please check your field mappings or CSV content.");
      } else {
          toast.success(`${validToImportCount} artworks ready for import!`);
      }
      
      setCurrentStep("preview");
    } catch (error: any) {
      console.error("Error during preview step:", error);
      toast.error(`Error processing CSV data: ${error.message || "Unknown error"}`);
    }
  };

  const toggleArtworkSelection = (originalRowIndex: number) => {
    console.log("Toggling artwork selection for row:", originalRowIndex);
    setParsedArtworks(prevArtworks =>
      prevArtworks.map(artwork =>
        artwork.originalRowIndex === originalRowIndex
          ? { ...artwork, isSelectedForImport: !artwork.isSelectedForImport }
          : artwork
      )
    );
  };

  const toggleSelectAllArtworks = (selectAll: boolean) => {
    console.log("Toggling select all artworks:", selectAll);
    setParsedArtworks(prevArtworks =>
      prevArtworks.map(artwork =>
        artwork.isValid ? { ...artwork, isSelectedForImport: selectAll } : artwork
      )
    );
  };
  
  const handleImport = async () => {
    console.log("Starting import process");
    
    const artworksToAttemptImport = parsedArtworks
      .filter(va => va.isValid && va.isSelectedForImport)
      .map(va => va.artwork);

    if (!artworksToAttemptImport.length) {
      toast.error("No valid artworks selected to import. Please check selections, mappings, and validation messages.");
      return;
    }

    console.log("Importing", artworksToAttemptImport.length, "artworks");
    setCurrentStep("importing");
    setImportingProgress(0);
    const totalToImport = artworksToAttemptImport.length;
    setImportStats({ successful: 0, failed: 0, skipped: 0, total: totalToImport });

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
      setCurrentStep("complete");
      
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
      setCurrentStep("preview"); // Return to preview on error
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
  };
}
