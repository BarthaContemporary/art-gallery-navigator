
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseCSVForPreview, parseMappedCSVToArtworks } from "@/lib/csv-utils"; // Updated import
import { supabase } from "@/integrations/supabase/client";
import { Artwork } from "@/hooks/use-artworks";
import { toast } from "sonner";
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
import { Upload, FileUp, ListChecks, StepForward, StepBack, CheckCircle2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CSVPreviewData, FieldMappings } from "./ArtworkFieldMapping.types"; // New import
import { FieldMappingStep } from "./FieldMappingStep"; // New import
import { Progress } from "@/components/ui/progress";

type ImportStep = "upload" | "mapFields" | "preview" | "importing" | "complete";

export function ImportCSVDialog() {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  
  const [csvPreviewData, setCsvPreviewData] = useState<CSVPreviewData | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMappings>({});
  const [parsedArtworks, setParsedArtworks] = useState<Partial<Artwork>[]>([]);
  
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [importingProgress, setImportingProgress] = useState(0);
  const [importStats, setImportStats] = useState({ successful: 0, failed: 0, total: 0 });

  const queryClient = useQueryClient();

  const resetState = () => {
    setFile(null);
    setCsvPreviewData(null);
    setFieldMappings({});
    setParsedArtworks([]);
    setCurrentStep("upload");
    setIsProcessingFile(false);
    setImportingProgress(0);
    setImportStats({ successful: 0, failed: 0, total: 0 });
  };

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

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
      // Initialize mappings: try to auto-map, or set all to null
      const initialMappings: FieldMappings = {};
      previewData.headers.forEach(header => {
        initialMappings[header] = null; // Auto-mapping will be attempted in FieldMappingStep
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
        toast.warn("No artworks could be generated with the current mappings. Please check your field mappings.");
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
    let successful = 0;
    let failed = 0;
    const total = parsedArtworks.length;
    setImportStats({ successful, failed, total });

    for (let i = 0; i < total; i++) {
      const artwork = parsedArtworks[i];
      // Remove id if present (for insert operation)
      const { id, ...artworkData } = artwork;

      const dataToInsert = {
        ...artworkData,
        // Default values are now handled in parseMappedCSVToArtworks
      };

      try {
        const { error } = await supabase.from("artworks").insert(dataToInsert);
        if (error) {
          console.error("Error importing artwork:", artwork.title, error);
          failed++;
        } else {
          successful++;
        }
      } catch (dbError) {
        console.error("Database Error importing artwork:", artwork.title, dbError);
        failed++;
      }
      
      setImportingProgress(((i + 1) / total) * 100);
      setImportStats({ successful, failed, total });
    }
    
    queryClient.invalidateQueries({ queryKey: ["artworks"] });
    setCurrentStep("complete");
  };
  
  const renderStepContent = () => {
    switch (currentStep) {
      case "upload":
        return (
          <div className="space-y-4 py-4 px-1">
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="csv-file"
                className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 mb-3 text-gray-500 dark:text-gray-400" />
                  <p className="mb-2 text-md text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">CSV files only</p>
                  {isProcessingFile && <p className="text-sm text-primary mt-2">Processing file...</p>}
                </div>
                <input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isProcessingFile}
                />
              </label>
            </div>
            {file && <p className="text-sm font-medium">Selected file: {file.name}</p>}
          </div>
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
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Preview Import</h3>
            <p className="text-sm text-muted-foreground">
              Found {parsedArtworks.length} artworks to import based on your mappings.
              Review the first few entries below.
            </p>
            {parsedArtworks.length > 0 ? (
              <ScrollArea className="h-64 border rounded-md p-4">
                <ul className="space-y-3">
                  {parsedArtworks.slice(0, 10).map((artwork, index) => (
                    <li key={index} className="text-sm border-b pb-2">
                      <p><span className="font-medium">Title:</span> {artwork.title || "N/A"}</p>
                      {artwork.artist_id && <p><span className="font-medium">Artist ID:</span> {artwork.artist_id}</p>}
                      {artwork.year && <p><span className="font-medium">Year:</span> {artwork.year}</p>}
                      {artwork.medium_type && <p><span className="font-medium">Medium:</span> {artwork.medium_type}</p>}
                      {artwork.price && <p><span className="font-medium">Price:</span> {artwork.price} {artwork.currency}</p>}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            ) : (
              <p className="text-orange-600">No artworks could be generated. Please go back and check your field mappings.</p>
            )}
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setCurrentStep("mapFields")}><StepBack className="mr-2 h-4 w-4"/>Back to Mapping</Button>
              <Button onClick={handleImport} disabled={parsedArtworks.length === 0}>
                <ListChecks className="mr-2 h-4 w-4"/>Import {parsedArtworks.length} Artworks
              </Button>
            </div>
          </div>
        );
      case "importing":
        return (
          <div className="space-y-4 text-center py-8">
            <h3 className="text-lg font-medium">Importing Artworks...</h3>
            <Progress value={importingProgress} className="w-full" />
            <p className="text-sm text-muted-foreground">
              {importStats.successful + importStats.failed} / {importStats.total} processed
            </p>
            <p className="text-sm">Successful: {importStats.successful}, Failed: {importStats.failed}</p>
          </div>
        );
      case "complete":
        return (
          <div className="space-y-4 text-center py-8">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
            <h3 className="text-xl font-medium">Import Complete!</h3>
            <p className="text-muted-foreground">
              Successfully imported {importStats.successful} artworks.
              {importStats.failed > 0 && ` Failed to import ${importStats.failed} artworks.`}
            </p>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </div>
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
        <Button variant="outline" size="sm" className="flex gap-1 md:gap-2 text-xs md:text-sm"> {/* Adjusted size and gap */}
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

        <ScrollArea className="flex-grow p-1 pr-2 -mr-1"> {/* Adjusted padding for better scrollbar visibility */}
          <div className="py-4 px-1"> {/* Main content padding */}
            {renderStepContent()}
          </div>
        </ScrollArea>

        {currentStep !== "mapFields" && currentStep !== "preview" && currentStep !== "importing" && currentStep !== "complete" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isProcessingFile || currentStep === "importing"}>
              Cancel
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
