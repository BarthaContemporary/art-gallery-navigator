
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import JSZip from "jszip";

export function useFileOperations(artwork_id: string, artistName: string, artworkTitle: string) {
  const [documents, setDocuments] = useState<any[]>([]);

  const formatFileName = (artistName: string, artworkTitle: string) => {
    return `B_c-${artistName}-${artworkTitle}`.replace(/[^a-zA-Z0-9-_]/g, '_');
  };

  const handleDownloadAllFiles = async () => {
    try {
      const { data: documents, error } = await supabase
        .from("documents")
        .select("*")
        .eq("artwork_id", artwork_id);

      if (error) throw error;

      if (!documents || documents.length === 0) {
        toast.error("No files available to download");
        return;
      }

      const zip = new JSZip();
      const baseFileName = formatFileName(artistName, artworkTitle);

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const response = await fetch(doc.file_url);
        const blob = await response.blob();
        zip.file(`${baseFileName}-${doc.file_name}`, blob);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${baseFileName}-Files.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast.success("All files downloaded successfully");
    } catch (error) {
      console.error("Error downloading files:", error);
      toast.error("Failed to download files");
    }
  };

  const handleDownloadSingleFile = async (doc: any) => {
    try {
      const response = await fetch(doc.file_url);
      const blob = await response.blob();
      const zip = new JSZip();
      const fileName = `B_c-FileDownload_${doc.file_name}`;
      
      zip.file(fileName, blob);
      
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = fileName + '.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      toast.success("File downloaded successfully");
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file");
    }
  };

  const handleDownloadAllImages = async () => {
    try {
      const { data: images, error } = await supabase
        .from("artwork_images")
        .select("*")
        .eq("artwork_id", artwork_id)
        .order("display_order", { ascending: true });

      if (error) throw error;

      if (!images || images.length === 0) {
        toast.error("No images available to download");
        return;
      }

      const zip = new JSZip();
      const baseFileName = formatFileName(artistName, artworkTitle);

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const response = await fetch(image.image_url);
        const blob = await response.blob();
        zip.file(`${baseFileName}_${i + 1}-${images.length}.jpg`, blob);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${baseFileName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast.success("Download started for all images");
    } catch (error) {
      console.error("Error downloading images:", error);
      toast.error("Failed to download images");
    }
  };

  useEffect(() => {
    const fetchDocuments = async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("artwork_id", artwork_id);

      if (error) {
        console.error("Error fetching documents:", error);
        return;
      }

      setDocuments(data || []);
    };

    fetchDocuments();
  }, [artwork_id]);

  return {
    documents,
    handleDownloadAllFiles,
    handleDownloadSingleFile,
    handleDownloadAllImages
  };
}
