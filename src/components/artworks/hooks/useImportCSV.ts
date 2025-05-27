
import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseCSVForPreview, parseMappedCSVToArtworks } from "@/lib/csv";
// import { supabase } from "@/integrations/supabase/client"; // Not directly used here anymore
import { toast } from "sonner";
import { CSVPreviewData, FieldMappings, ProcessedArtworkForImport } from "@/components/artworks/ArtworkFieldMapping.types";
import { ImportStep, ImportStats, UseImportCSVReturn } from "@/components/artworks/import-steps/types";
import { performArtworkImport } from './artworkImporter';

export function useImportCSV(initialOpen: boolean = false, onCloseDialog?: () => void): UseImportCSVReturn {
  const [open, setOpen] = useState(initialOpen);
  const [currentStep, setCurrentStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  
  const [csvPreviewData, setCsvPreviewData] = useState<CSVPreviewData | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMappings>({});
  const [parsedArtworks, setParsedArtworks] = useState<ProcessedArtworkForImport[]>([]);
  
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [importingProgress, setImportingProgress] = useState(0);
  const [importStats, setImportStats] = useState<ImportStats>({ successful: 0, failed: 0, skipped: 0, total: 0 }); // Added skipped

  const queryClient = useQueryClient();

  const resetState = useCallback(() => {
    setFile(null);
    setCsvPreviewData(null);
    setFieldMappings({});
    setParsedArtworks([]);
    setCurrentStep("upload");
    setIsProcessingFile(false);
    setImportingProgress(0);
    setImportStats({ successful: 0, failed: 0, skipped: 0, total: 0 }); // Added skipped
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
    const artworks = parseMappedCSVToArtworks(csvPreviewData.rows, fieldMappings);
    setParsedArtworks(artworks);
    if (artworks.length === 0) {
        toast.warning("No artworks could be generated with the current mappings. Please check your field mappings.");
    }
    setCurrentStep("preview");
  };
  
  const handleImport = async () => {
    if (!parsedArtworks.length) {
      toast.error("No artworks to import. Please check mappings or CSV data.");
      return;
    }

    setCurrentStep("importing");
    setImportingProgress(0);
    const total = parsedArtworks.length;
    setImportStats({ successful: 0, failed: 0, skipped: 0, total }); // Added skipped

    const { successful, failed, skipped } = await performArtworkImport(
      parsedArtworks,
      (progress) => setImportingProgress(progress),
      (stats) => setImportStats(prevStats => ({
        ...prevStats, 
        successful: stats.successful, 
        failed: stats.failed,
        skipped: stats.skipped // Added skipped
      }))
    );
    
    setImportStats({ successful, failed, skipped, total }); // Added skipped
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
  };
}
