
import { exportDatabaseAsJson } from './jsonExport';
import { exportAllMediaAsZip } from './mediaExport';
import { exportDataAsCsvZip } from './csvExport';

export type ExportType = 'full' | 'data-only' | 'media-only';

export async function exportData(
  type: ExportType,
  onProgress?: (progress: number) => void
): Promise<void> {
  onProgress?.(0);

  try {
    switch (type) {
      case 'full':
        // For full backup, export both data and media
        onProgress?.(25);
        await exportDatabaseAsJson();
        onProgress?.(75);
        await exportAllMediaAsZip();
        onProgress?.(100);
        break;
      
      case 'data-only':
        onProgress?.(50);
        await exportDataAsCsvZip();
        onProgress?.(100);
        break;
      
      case 'media-only':
        onProgress?.(50);
        await exportAllMediaAsZip();
        onProgress?.(100);
        break;
      
      default:
        throw new Error(`Unknown export type: ${type}`);
    }
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}
