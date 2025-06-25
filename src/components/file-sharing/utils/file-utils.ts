
import { EnhancedDocument } from "@/hooks/use-enhanced-documents";
import { Folder } from "@/hooks/use-folders";

export const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

export const getItemName = (item: { type: string; data: Folder | EnhancedDocument }) => {
  return item.type === 'folder' 
    ? (item.data as Folder).name 
    : (item.data as EnhancedDocument).file_name;
};
