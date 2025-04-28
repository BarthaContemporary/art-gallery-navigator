
import { useState } from "react";
import { useDialog } from "@/hooks/use-dialog";

export function useDocumentDropzone() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { isOpen, onOpenChange } = useDialog(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    onOpenChange(true);
  };

  const handleClose = () => {
    setSelectedFile(null);
    onOpenChange(false);
    setIsUploading(false);
  };

  const handleOpen = () => {
    onOpenChange(true);
  };

  return {
    selectedFile,
    isOpen,
    isUploading,
    setIsUploading,
    onOpenChange: handleOpen,
    handleFileSelect
  };
}
