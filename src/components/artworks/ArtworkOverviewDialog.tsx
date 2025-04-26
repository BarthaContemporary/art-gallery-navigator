
import React, { useState, useEffect } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { useArtist } from "@/hooks/use-artist";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createArtworkPDF } from "@/lib/create-artwork-pdf";
import { toast } from "sonner";
import { Save, Download, Files } from "lucide-react";
import { PDFPreviewDialog } from "../pdf/PDFPreviewDialog";
import { ArtworkPDFPreview } from "../pdf/ArtworkPreview";
import { ArtworkCarousel } from "./ArtworkCarousel";
import { ArtworkDetailsSection } from "./overview/ArtworkDetailsSection";
import { DimensionsSection } from "./overview/DimensionsSection";
import { AdditionalInfoSection } from "./overview/AdditionalInfoSection";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

interface ArtworkOverviewDialogProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArtworkOverviewDialog({
  artwork,
  open,
  onOpenChange,
}: ArtworkOverviewDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfPreviewOpen, setPDFPreviewOpen] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const { data: artist, isLoading: artistLoading } = useArtist(artwork.artist_id);
  const navigate = useNavigate();
  
  const formatFileName = (artistName: string, artworkTitle: string) => {
    return `B_c-${artistName}-${artworkTitle}`.replace(/[^a-zA-Z0-9-_]/g, '_');
  };

  const handleGeneratePDF = (templateStyle: string, useStationery: boolean) => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    createArtworkPDF(artwork, templateStyle, useStationery)
      .then(() => {
        // Success is handled by the PDF generator
      })
      .catch((error) => {
        console.error("Error generating PDF:", error);
        toast.error("Failed to generate PDF");
      })
      .finally(() => {
        setIsGenerating(false);
      });
  };

  const handleDownloadAllImages = async () => {
    try {
      const { data: images, error } = await supabase
        .from("artwork_images")
        .select("*")
        .eq("artwork_id", artwork.id)
        .order("display_order", { ascending: true });

      if (error) throw error;

      if (!images || images.length === 0) {
        toast.error("No images available to download");
        return;
      }

      const zip = new JSZip();
      const artistName = artist?.full_name || 'Unknown_Artist';
      const baseFileName = formatFileName(artistName, artwork.title);

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

  const handleDownloadAllFiles = async () => {
    try {
      const { data: documents, error } = await supabase
        .from("documents")
        .select("*")
        .eq("artwork_id", artwork.id);

      if (error) throw error;

      if (!documents || documents.length === 0) {
        toast.error("No files available to download");
        return;
      }

      const zip = new JSZip();
      const baseFileName = formatFileName(artist?.full_name || 'Unknown_Artist', artwork.title);

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

  useEffect(() => {
    if (open && artwork.id) {
      const fetchDocuments = async () => {
        const { data, error } = await supabase
          .from("documents")
          .select("*")
          .eq("artwork_id", artwork.id);

        if (error) {
          console.error("Error fetching documents:", error);
          return;
        }

        setDocuments(data || []);
      };

      fetchDocuments();
    }
  }, [open, artwork.id]);

  const handleViewDocuments = () => {
    navigate(`/documents?artwork=${artwork.id}`);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex justify-between items-center relative">
              <DialogTitle className="text-2xl font-bold">
                {artwork.title}
              </DialogTitle>
              <div className="flex gap-2 absolute right-8">
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => setPDFPreviewOpen(true)}
                  disabled={isGenerating}
                >
                  <Save className="h-4 w-4" />
                  {isGenerating ? "Creating PDF..." : "Create PDF"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Files className="h-4 w-4" />
                      Download Files
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {documents.length > 0 ? (
                      <>
                        <DropdownMenuItem onClick={handleDownloadAllFiles}>
                          Download All Files
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {documents.map((doc) => (
                          <DropdownMenuItem
                            key={doc.id}
                            onClick={() => handleDownloadSingleFile(doc)}
                          >
                            {doc.file_name}
                          </DropdownMenuItem>
                        ))}
                      </>
                    ) : (
                      <DropdownMenuItem disabled>
                        No files available
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={handleDownloadAllImages}
                >
                  <Download className="h-4 w-4" />
                  Download All Images
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            <div className="mb-8">
              <ArtworkCarousel 
                artworkId={artwork.id} 
                artistName={artist?.full_name || "Unknown_Artist"} 
                artworkTitle={artwork.title} 
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-6">
              <div className="space-y-8">
                <ArtworkDetailsSection artwork={artwork} artist={artist} artistLoading={artistLoading} />
                <DimensionsSection artwork={artwork} />
              </div>
              <div>
                <AdditionalInfoSection artwork={artwork} />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <PDFPreviewDialog
        open={pdfPreviewOpen}
        onOpenChange={setPDFPreviewOpen}
        onApply={handleGeneratePDF}
        title={artwork.title}
        content={<ArtworkPDFPreview artwork={artwork} templateStyle="basic" />}
        type="artwork"
      />
    </>
  );
}
