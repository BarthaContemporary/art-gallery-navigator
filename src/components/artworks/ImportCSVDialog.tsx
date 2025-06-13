
import { Button } from "@/components/ui/button";
import {
  ScrollableDialog,
  ScrollableDialogContent,
  ScrollableDialogHeader,
  ScrollableDialogTitle,
  ScrollableDialogTrigger,
  ScrollableDialogDescription,
  ScrollableDialogFooter,
  ScrollableDialogBody,
} from "@/components/ui/scrollable-dialog";
import { FileUp } from "lucide-react";
import { FieldMappingStep } from "./FieldMappingStep";
import { useImportCSV } from "./hooks/useImportCSV";
import { UploadStep } from "./import-steps/UploadStep";
import { PreviewStep } from "./import-steps/PreviewStep";
import { ImportingStep } from "./import-steps/ImportingStep";
import { CompleteStep } from "./import-steps/CompleteStep";
import { useScrollableDialog } from "@/hooks/use-scrollable-dialog";

export function ImportCSVDialog() {
  const {
    open,
    setOpen,
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
    toggleArtworkSelection,
    toggleSelectAllArtworks,
  } = useImportCSV(false);

  const { scrollToTop } = useScrollableDialog(open, {
    enableKeyboardNavigation: true
  });
  
  const renderStepContent = () => {
    switch (currentStep) {
      case "upload":
        return (
          <UploadStep
            onFileChange={handleFileChange}
            file={file}
            isProcessingFile={isProcessingFile}
          />
        );
      case "mapFields":
        if (!csvPreviewData) return <p>Loading CSV data...</p>;
        return (
          <FieldMappingStep
            csvPreviewData={csvPreviewData}
            mappings={fieldMappings}
            onMappingsChange={handleMappingsChanged}
            onNext={() => { goToPreviewStep(); scrollToTop(); }}
            onBack={() => { setCurrentStep("upload"); scrollToTop(); }}
          />
        );
      case "preview":
        return (
          <PreviewStep
            parsedArtworks={parsedArtworks}
            onImport={() => { handleImport(); scrollToTop(); }}
            onBack={() => { setCurrentStep("mapFields"); scrollToTop(); }}
            toggleArtworkSelection={toggleArtworkSelection}
            toggleSelectAllArtworks={toggleSelectAllArtworks}
          />
        );
      case "importing":
        return (
          <ImportingStep
            importingProgress={importingProgress}
            importStats={importStats}
          />
        );
      case "complete":
        return (
          <CompleteStep
            importStats={importStats}
            onClose={() => setOpen(false)}
          />
        );
    }
  };
  
  const getDialogTitle = () => {
    switch (currentStep) {
        case "upload": return "Upload CSV File";
        case "mapFields": return "Map CSV Fields";
        case "preview": return "Preview Import";
        case "importing": return "Importing Artworks";
        case "complete": return "Import Complete";
        default: return "Import Artworks from CSV";
    }
  };

  return (
    <ScrollableDialog open={open} onOpenChange={setOpen}>
      <ScrollableDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileUp className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </ScrollableDialogTrigger>
      <ScrollableDialogContent size="4xl">
        <ScrollableDialogHeader>
          <ScrollableDialogTitle>{getDialogTitle()}</ScrollableDialogTitle>
          {currentStep === "upload" && (
            <ScrollableDialogDescription>
              Upload a CSV file to import multiple artworks. You'll be able to map columns in the next step.
            </ScrollableDialogDescription>
          )}
        </ScrollableDialogHeader>

        <ScrollableDialogBody>
          {renderStepContent()}
        </ScrollableDialogBody>

        {currentStep === "upload" && !isProcessingFile && (
          <ScrollableDialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </ScrollableDialogFooter>
        )}
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}
