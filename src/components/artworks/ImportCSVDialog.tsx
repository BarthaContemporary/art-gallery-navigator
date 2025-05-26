import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseCSVtoArtworks } from "@/lib/csv-utils";
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
import { Upload, FileUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ImportCSVDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [artworks, setArtworks] = useState<Partial<Artwork>[]>([]);
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      setFile(null);
      setArtworks([]);
      return;
    }

    const selectedFile = e.target.files[0];
    setFile(selectedFile);

    try {
      const parsed = await parseCSVtoArtworks(selectedFile);
      setArtworks(parsed);
    } catch (error) {
      console.error("Error parsing CSV:", error);
      toast.error("Failed to parse CSV file. Please check the format.");
      setFile(null);
      setArtworks([]);
    }
  };

  const handleImport = async () => {
    if (!artworks.length) return;

    setImporting(true);
    let successful = 0;
    let failed = 0;

    try {
      // Process each artwork
      for (const artwork of artworks) {
        // Remove id if present (for insert operation)
        const { id, ...artworkData } = artwork;

        // Ensure required fields have default values if missing
        const dataToInsert = {
          ...artworkData,
          // Set default values for required fields if they're missing
          classification: artworkData.classification || 'Unique',
          medium_type: artworkData.medium_type || 'Painting',
          title: artworkData.title || 'Untitled',
          currency: artworkData.currency || 'USD'
        };

        const { error } = await supabase.from("artworks").insert(dataToInsert);

        if (error) {
          console.error("Error importing artwork:", error);
          failed++;
        } else {
          successful++;
        }
      }

      toast.success(`Imported ${successful} artworks successfully${failed > 0 ? `, ${failed} failed` : ''}`);
      queryClient.invalidateQueries({ queryKey: ["artworks"] });
      setOpen(false);
      setFile(null);
      setArtworks([]);
    } catch (error) {
      console.error("Error during import:", error);
      toast.error("An error occurred during import");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex gap-2">
          <FileUp />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Artworks from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple artworks at once.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-grow p-1">
          <div className="space-y-4 py-4 px-1">
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="csv-file"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 text-gray-500 dark:text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    CSV files only
                  </p>
                </div>
                <input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {file && (
              <div>
                <p className="text-sm font-medium">Selected file: {file.name}</p>
                <p className="text-sm text-muted-foreground">
                  Found {artworks.length} artworks to import
                </p>
              </div>
            )}

            {artworks.length > 0 && (
              <div className="border rounded-md">
                <ScrollArea className="h-56">
                  <div className="p-4">
                    <h3 className="font-medium mb-2">Preview (First 5 artworks)</h3>
                    <ul className="space-y-2">
                      {artworks.slice(0, 5).map((artwork, index) => (
                        <li key={index} className="text-sm border-b pb-2">
                          <span className="font-medium">{artwork.title}</span>
                          {artwork.year && <span className="text-muted-foreground ml-2">({artwork.year})</span>}
                          {artwork.medium_type && <p className="text-xs text-muted-foreground mt-1">Medium: {artwork.medium_type}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={importing || artworks.length === 0}
          >
            {importing ? "Importing..." : `Import ${artworks.length} Artworks`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
