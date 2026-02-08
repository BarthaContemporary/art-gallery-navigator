

# Auto-trigger Batch Thumbnail Processing After Excel Image Import

## Overview

After importing image URLs from an Excel file, the system currently creates `artwork_images` records with `processed: false` but does not trigger any thumbnail generation. This plan adds automatic batch processing at the end of the import flow, using the existing `batch-process-unprocessed-images` edge function.

## Changes

### 1. Update `ImportExcelImagesDialog.tsx`

- After `importImageUrlsForArtworks` completes successfully (in the `handleImport` function), automatically call the `batch-process-unprocessed-images` edge function with a limit matching the number of successfully imported images.
- Show a secondary progress state on the "complete" step indicating thumbnail generation is in progress.
- Display the batch processing result (how many thumbnails were generated) on the completion screen.

### 2. UI Updates on the Completion Screen

- Add a "Generating thumbnails..." status indicator below the import summary while batch processing runs.
- Once complete, show a count of thumbnails generated (e.g., "12 thumbnails generated").
- If batch processing fails, show a subtle warning but don't block the user -- the import itself already succeeded.

## Technical Details

### In `src/components/artworks/ImportExcelImagesDialog.tsx`:

**New state variables:**
- `batchProcessing: boolean` -- tracks whether thumbnail generation is running
- `batchResult: { processedCount, failedCount } | null` -- stores the result

**Modified `handleImport` function:**
```typescript
const handleImport = async () => {
  if (!matchResult) return;
  setImporting(true);
  setStep('importing');

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
        console.warn('Batch processing failed:', e);
      } finally {
        setBatchProcessing(false);
      }
    }
  } catch (error) {
    toast.error('Import failed');
  } finally {
    setImporting(false);
  }
};
```

**Updated completion screen:** Below the existing import stats grid, add a conditional section:
- While `batchProcessing` is true: show a spinner with "Generating thumbnails..."
- When `batchResult` is available: show processed/failed counts
- On failure: show a subtle "Thumbnail generation will be retried later" message

### No edge function changes needed
The existing `batch-process-unprocessed-images` function already queries for `artwork_images` with null `thumbnail_url` or `medium_url` and invokes `process-artwork-image-cloudinary` for each -- exactly the records the import creates.

