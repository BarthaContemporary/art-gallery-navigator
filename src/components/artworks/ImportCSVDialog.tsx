import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FieldMappingStep } from "./FieldMappingStep";
import { useImportCSV } from "./hooks/useImportCSV";
import { UploadStep } from "./import-steps/UploadStep";
import { PreviewStep } from "./import-steps/PreviewStep";
import { ImportingStep } from "./import-steps/ImportingStep";
import { CompleteStep } from "./import-steps/CompleteStep";

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
            onNext={goToPreviewStep}
            onBack={() => setCurrentStep("upload")}
          />
        );
      case "preview":
        return (
          <PreviewStep
            parsedArtworks={parsedArtworks}
            onImport={handleImport}
            onBack={() => setCurrentStep("mapFields")}
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex gap-1 md:gap-2 text-xs md:text-sm">
          <FileUp className="h-3 w-3 md:h-4 md:w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          {currentStep === "upload" && (
            <DialogDescription>
              Upload a CSV file to import multiple artworks. You'll be able to map columns in the next step.
            </DialogDescription>
          )}
        </DialogHeader>

        <ScrollArea className="flex-grow p-1 pr-2 -mr-1">
          <div className="py-4 px-1">
            {renderStepContent()}
          </div>
        </ScrollArea>

        {currentStep === "upload" && !isProcessingFile && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
