
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useImportCSV } from "./hooks/useImportCSV";
import { UploadStep } from "./import-steps/UploadStep";
import { FieldMappingStep } from "./FieldMappingStep";
import { PreviewStep } from "./import-steps/PreviewStep";
import { ImportingStep } from "./import-steps/ImportingStep";
import { CompleteStep } from "./import-steps/CompleteStep";
import { ImportStep } from "./import-steps/types";

export function ImportCSVDialog() {
  const [open, setOpen] = useState(false);
  const {
    currentStep,
    setCurrentStep,
    file,
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
  } = useImportCSV();

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetState();
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case ImportStep.UPLOAD:
        return (
          <UploadStep
            onFileChange={handleFileChange}
            file={file}
            isProcessingFile={isProcessingFile}
          />
        );
      case ImportStep.FIELD_MAPPING:
        return (
          <FieldMappingStep
            csvData={csvPreviewData!}
            fieldMapping={fieldMappings}
            onFieldMappingChange={handleMappingsChanged}
            onNext={goToPreviewStep}
            onBack={() => setCurrentStep(ImportStep.UPLOAD)}
          />
        );
      case ImportStep.PREVIEW:
        return (
          <PreviewStep
            parsedArtworks={parsedArtworks}
            onBack={() => setCurrentStep(ImportStep.FIELD_MAPPING)}
            onImport={handleImport}
            toggleArtworkSelection={toggleArtworkSelection}
            toggleSelectAllArtworks={toggleSelectAllArtworks}
          />
        );
      case ImportStep.IMPORTING:
        return (
          <ImportingStep
            importingProgress={importingProgress}
            importStats={importStats}
          />
        );
      case ImportStep.COMPLETE:
        return (
          <CompleteStep
            importStats={importStats}
            onClose={() => handleOpenChange(false)}
          />
        );
      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case ImportStep.UPLOAD:
        return "Upload CSV File";
      case ImportStep.FIELD_MAPPING:
        return "Map Fields";
      case ImportStep.PREVIEW:
        return "Preview Import";
      case ImportStep.IMPORTING:
        return "Importing Artworks";
      case ImportStep.COMPLETE:
        return "Import Complete";
      default:
        return "Import CSV";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
        </DialogHeader>
        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
}
