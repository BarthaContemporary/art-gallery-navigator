import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSpreadsheet, Upload, Check, X, AlertCircle, Image, Loader2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  parseExcelFile, 
  ExcelParseResult, 
  findTitleColumn, 
  findArtistColumn, 
  findYearColumn, 
  findImageUrlColumn,
  isValidImageUrl 
} from "@/lib/excel/parse-excel";
import { 
  matchArtworksFromExcel, 
  importImageUrlsForArtworks,
  ArtworkMatch,
  MatchResult
} from "@/services/artwork-image-matcher";

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

export function ImportExcelImagesDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [excelData, setExcelData] = useState<ExcelParseResult | null>(null);
  const [titleColumn, setTitleColumn] = useState<string>('');
  const [artistColumn, setArtistColumn] = useState<string>('');
  const [yearColumn, setYearColumn] = useState<string>('');
  const [imageUrlColumn, setImageUrlColumn] = useState<string>('');
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; skipped: number } | null>(null);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchResult, setBatchResult] = useState<{ processedCount: number; failedCount: number } | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    try {
      const data = await parseExcelFile(file);
      setExcelData(data);
      
      // Auto-detect columns
      setTitleColumn(findTitleColumn(data.headers) || '');
      setArtistColumn(findArtistColumn(data.headers) || '');
      setYearColumn(findYearColumn(data.headers) || '');
      setImageUrlColumn(findImageUrlColumn(data.headers) || '');
      
      setStep('mapping');
      toast.success(`Loaded ${data.totalRows} rows from Excel file`);
    } catch (error) {
      toast.error('Failed to parse Excel file');
      console.error(error);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1
  });

  const handleMatchArtworks = async () => {
    if (!excelData || !titleColumn || !imageUrlColumn) {
      toast.error('Please select title and image URL columns');
      return;
    }

    try {
      const result = await matchArtworksFromExcel(
        excelData.rows,
        titleColumn,
        artistColumn || null,
        yearColumn || null,
        imageUrlColumn
      );
      setMatchResult(result);
      setStep('preview');
    } catch (error) {
      toast.error('Failed to match artworks');
      console.error(error);
    }
  };

  const handleImport = async () => {
    if (!matchResult) return;

    setImporting(true);
    setStep('importing');
    setImportProgress(0);

    try {
      const result = await importImageUrlsForArtworks(matchResult.matches, onlyMissing);
      setImportResult(result);
      setStep('complete');
      toast.success(`Imported ${result.success} images successfully`);

      // Auto-trigger batch processing if any images were imported
      if (result.success > 0) {
        setBatchProcessing(true);
        try {
          const { data, error } = await supabase.functions.invoke(
            'batch-process-unprocessed-images',
            { body: { limit: result.success } }
          );
          if (!error && data) {
            setBatchResult(data);
          }
        } catch (e) {
          console.warn('Batch thumbnail processing failed:', e);
        } finally {
          setBatchProcessing(false);
        }
      }
    } catch (error) {
      toast.error('Import failed');
      console.error(error);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setStep('upload');
      setExcelData(null);
      setMatchResult(null);
      setImportResult(null);
      setBatchProcessing(false);
      setBatchResult(null);
      setTitleColumn('');
      setArtistColumn('');
      setYearColumn('');
      setImageUrlColumn('');
    }, 300);
  };

  const getConfidenceBadge = (confidence: ArtworkMatch['matchConfidence']) => {
    switch (confidence) {
      case 'exact':
        return <Badge className="bg-green-500">Exact</Badge>;
      case 'high':
        return <Badge className="bg-blue-500">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500">Medium</Badge>;
      case 'low':
        return <Badge className="bg-orange-500">Low</Badge>;
      case 'none':
        return <Badge variant="destructive">No Match</Badge>;
    }
  };

  const validImageCount = matchResult?.matches.filter(
    m => m.matchConfidence !== 'none' && isValidImageUrl(m.imageUrl) && (!onlyMissing || !m.hasExistingImages)
  ).length || 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Import Images from Excel">
          <FileSpreadsheet className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Import Artwork Images from Excel
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
              transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">
              {isDragActive ? 'Drop the Excel file here' : 'Drag & drop an Excel file here'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              or click to select a file (.xlsx, .xls)
            </p>
          </div>
        )}

        {step === 'mapping' && excelData && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Found {excelData.totalRows} rows. Map the columns to match artworks:
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title Column *</Label>
                <Select value={titleColumn} onValueChange={setTitleColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select title column" />
                  </SelectTrigger>
                  <SelectContent>
                    {excelData.headers.map(header => (
                      <SelectItem key={header} value={header}>{header}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Image URL Column *</Label>
                <Select value={imageUrlColumn} onValueChange={setImageUrlColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select image URL column" />
                  </SelectTrigger>
                  <SelectContent>
                    {excelData.headers.map(header => (
                      <SelectItem key={header} value={header}>{header}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Artist Column (optional)</Label>
                <Select value={artistColumn} onValueChange={setArtistColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select artist column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {excelData.headers.map(header => (
                      <SelectItem key={header} value={header}>{header}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Year Column (optional)</Label>
                <Select value={yearColumn} onValueChange={setYearColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {excelData.headers.map(header => (
                      <SelectItem key={header} value={header}>{header}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleMatchArtworks} disabled={!titleColumn || !imageUrlColumn}>
                Match Artworks
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && matchResult && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{matchResult.matches.length}</div>
                <div className="text-xs text-muted-foreground">Total Rows</div>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{matchResult.matchedCount}</div>
                <div className="text-xs text-muted-foreground">Matched</div>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{matchResult.unmatchedCount}</div>
                <div className="text-xs text-muted-foreground">Unmatched</div>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{validImageCount}</div>
                <div className="text-xs text-muted-foreground">To Import</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox 
                id="onlyMissing" 
                checked={onlyMissing} 
                onCheckedChange={(checked) => setOnlyMissing(checked as boolean)} 
              />
              <Label htmlFor="onlyMissing" className="text-sm">
                Only import for artworks missing images
              </Label>
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-2 space-y-2">
                {matchResult.matches.slice(0, 100).map((match, index) => (
                  <div 
                    key={index} 
                    className={`p-3 rounded-lg border ${
                      match.matchConfidence === 'none' ? 'bg-muted/50' : 'bg-background'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {String(match.excelRow[titleColumn] || 'Untitled')}
                        </div>
                        {match.artworkTitle && match.matchConfidence !== 'none' && (
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Check className="h-3 w-3 text-green-500" />
                            Matches: {match.artworkTitle}
                            {match.artistName && ` by ${match.artistName}`}
                          </div>
                        )}
                        {match.imageUrl && (
                          <div className="text-xs text-muted-foreground truncate mt-1">
                            {match.imageUrl}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {match.hasExistingImages && (
                          <Badge variant="outline" className="text-xs">Has Images</Badge>
                        )}
                        {getConfidenceBadge(match.matchConfidence)}
                      </div>
                    </div>
                  </div>
                ))}
                {matchResult.matches.length > 100 && (
                  <div className="text-center text-sm text-muted-foreground py-2">
                    ... and {matchResult.matches.length - 100} more rows
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={validImageCount === 0}>
                Import {validImageCount} Images
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-12 text-center space-y-4">
            <div className="animate-pulse">
              <Upload className="h-12 w-12 mx-auto text-primary" />
            </div>
            <p className="text-lg font-medium">Importing images...</p>
            <Progress value={importProgress} className="max-w-md mx-auto" />
          </div>
        )}

        {step === 'complete' && importResult && (
          <div className="py-8 text-center space-y-6">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Import Complete</h3>
              <p className="text-muted-foreground mt-1">
                Successfully imported image URLs for your artworks
              </p>
            </div>
            
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="p-4 bg-green-500/10 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{importResult.success}</div>
                <div className="text-xs text-muted-foreground">Imported</div>
              </div>
              <div className="p-4 bg-yellow-500/10 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{importResult.skipped}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
              <div className="p-4 bg-red-500/10 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{importResult.failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>

            {/* Batch thumbnail processing status */}
            {batchProcessing && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating thumbnails...
              </div>
            )}
            {batchResult && !batchProcessing && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p className="text-green-600">{batchResult.processedCount} thumbnails generated</p>
                {batchResult.failedCount > 0 && (
                  <p className="text-yellow-600">{batchResult.failedCount} failed (will be retried later)</p>
                )}
              </div>
            )}
            {!batchProcessing && !batchResult && importResult.success > 0 && (
              <p className="text-xs text-muted-foreground">Thumbnail generation will be retried later</p>
            )}

            <Button onClick={handleClose} disabled={batchProcessing}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
