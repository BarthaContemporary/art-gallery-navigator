
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import JSZip from 'jszip';
import type { TableName } from './constants';

export const exportAllMediaAsZip = async () => {
  toast.info("Starting media files export... This may take a while.");
  const zip = new JSZip();
  let filesAdded = 0;

  const sources = [
    { table: 'artwork_images' as TableName, urlColumn: 'image_url', fallbackName: 'artwork_image' },
    { table: 'artwork_images' as TableName, urlColumn: 'medium_url', fallbackName: 'artwork_medium_image' },
    { table: 'artwork_images' as TableName, urlColumn: 'thumbnail_url', fallbackName: 'artwork_thumbnail_image' },
    { table: 'documents' as TableName, urlColumn: 'file_url', nameColumn: 'file_name', fallbackName: 'document' },
    { table: 'uploads' as TableName, urlColumn: 'file_url', nameColumn: 'file_name', fallbackName: 'upload' },
    { table: 'artists' as TableName, urlColumn: 'image_url', fallbackName: 'artist_image' },
    { table: 'exhibitions' as TableName, urlColumn: 'image_url', fallbackName: 'exhibition_image' },
  ];

  for (const source of sources) {
    const selectColumns: string[] = [source.urlColumn, 'id'];
    if (source.nameColumn) {
      selectColumns.push(source.nameColumn);
    }

    const { data, error } = await supabase.from(source.table).select(selectColumns.join(','));
    
    if (error) {
      console.error(`Error fetching media from ${source.table}:`, error);
      toast.warning(`Could not fetch some media from ${source.table}.`);
      continue;
    }

    if (data) {
      for (const item of data as any[]) {
        const url = item[source.urlColumn];
        if (url && typeof url === 'string') {
          try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
            const blob = await response.blob();
            
            let fileNamePart = source.nameColumn ? item[source.nameColumn] : null;
            if (!fileNamePart) {
              const extension = blob.type.split('/')[1] || 'file';
              fileNamePart = `${source.fallbackName}_${item.id}.${extension}`;
            }
            const fileName = `${source.table}/${fileNamePart}`;

            zip.file(fileName, blob);
            filesAdded++;
          } catch (fetchError) {
            console.error(`Failed to download or add file ${url} to zip:`, fetchError);
            toast.warning(`Skipped file: ${url.substring(url.lastIndexOf('/') + 1)}`);
          }
        }
      }
    }
  }

  if (filesAdded === 0) {
    toast.error("No media files found or could be processed.");
    return;
  }

  zip.generateAsync({ type: 'blob' })
    .then((content) => {
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `media_backup_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`${filesAdded} media files exported successfully.`);
    })
    .catch(err => {
      console.error("Error generating zip file:", err);
      toast.error("Failed to generate ZIP file for media.");
    });
};

