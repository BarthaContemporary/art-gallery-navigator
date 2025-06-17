
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileDown, Settings } from "lucide-react";
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
    csvData,
    setCsvData,
    fieldMapping,
    setFieldMapping,
    previewData,
    setPreviewData,
    importResults,
    setImportResults,
    isImporting,
    setIsImporting,
    resetImport,
  } = useImportCSV();

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetImport();
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case ImportStep.UPLOAD:
        return (
          <UploadStep
            onFileProcessed={(data) => {
              setCsvData(data);
              setCurrentStep(ImportStep.FIELD_MAPPING);
            }}
          />
        );
      case ImportStep.FIELD_MAPPING:
        return (
          <FieldMappingStep
            csvData={csvData}
            fieldMapping={fieldMapping}
            onFieldMappingChange={setFieldMapping}
            onNext={(previewData) => {
              setPreviewData(previewData);
              setCurrentStep(ImportStep.PREVIEW);
            }}
            onBack={() => setCurrentStep(ImportStep.UPLOAD)}
          />
        );
      case ImportStep.PREVIEW:
        return (
          <PreviewStep
            previewData={previewData}
            onBack={() => setCurrentStep(ImportStep.FIELD_MAPPING)}
            onConfirm={() => setCurrentStep(ImportStep.IMPORTING)}
          />
        );
      case ImportStep.IMPORTING:
        return (
          <ImportingStep
            previewData={previewData}
            onComplete={(results) => {
              setImportResults(results);
              setCurrentStep(ImportStep.COMPLETE);
            }}
          />
        );
      case ImportStep.COMPLETE:
        return (
          <CompleteStep
            results={importResults}
            onClose={() => handleOpenChange(false)}
            onImportMore={() => {
              resetImport();
              setCurrentStep(ImportStep.UPLOAD);
            }}
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
