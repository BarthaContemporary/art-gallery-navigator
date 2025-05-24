
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PDFPreviewContent } from "./PDFPreviewContent";
import { preloadStationeryImage } from "@/lib/pdf/stationery-utils"; // For preloading

interface PDFPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (useStationery: boolean) => void; // Removed templateStyle from here
  title: string;
  content: React.ReactNode; // This will be ArtworkPDFPreview or CollectionPDFPreview
  type: "artwork" | "collection";
}

export function PDFPreviewDialog({
  open,
  onOpenChange,
  onApply,
  title,
  content, // Passed in, typically ArtworkPDFPreview or CollectionPDFPreview
  type,
}: PDFPreviewDialogProps) {
  // const [selectedTemplate, setSelectedTemplate] = useState(type === "artwork" ? "classic" : "collection"); // "classic" was default
  // For artwork, template is now fixed, so selectedTemplate is not directly used by artwork PDF generation
  // For collections, it might still be relevant if collections have templates.
  // The request focused on artwork, so let's assume collection template selection remains for now if it exists.
  // Based on request, artwork always uses stationery and has one style.
  const [effectiveSelectedTemplate, setEffectiveSelectedTemplate] = useState(
    type === "artwork" ? "unified_artwork_style" : "collection_default" // Using placeholder names
  );

  // Stationery is now always true for artworks as per request.
  // For collections, it might still be a choice.
  const [useStationery, setUseStationery] = useState(type === "artwork" ? true : false);

  useEffect(() => {
    if (open) {
      preloadStationeryImage().catch(err => console.error("Failed to preload stationery", err));
      // If artwork, always use stationery.
      if (type === "artwork") {
        setUseStationery(true);
      }
    }
  }, [open, type]);
  
  // If type is artwork, template selection is removed.
  // onApply will just pass useStationery (which will be true for artworks)
  const handleApply = () => {
    // For artworks, templateStyle is no longer relevant.
    // onApply now only expects useStationery.
    onApply(useStationery);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] md:w-full h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 border-b">
          <DialogTitle className="text-xl font-semibold">
            Create PDF for: {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/*
            PDFPreviewContent handles the layout with controls on left and preview on right.
            For artworks, template selection in PDFPreviewContent and PDFTemplateControls will be hidden/removed.
          */}
          <PDFPreviewContent
            type={type}
            // selectedTemplate and setSelectedTemplate are still passed for collections.
            // For artworks, these will be ignored or hidden by PDFPreviewContent/PDFTemplateControls.
            selectedTemplate={effectiveSelectedTemplate} 
            setSelectedTemplate={setEffectiveSelectedTemplate}
            useStationery={useStationery}
            setUseStationery={setUseStationery} // Still allow toggling for collections, artworks fixed to true
            title={title}
            // The 'content' prop (actual ArtworkPDFPreview or CollectionPDFPreview) is rendered by PDFPreviewContent.
            // This 'content' prop is distinct from the simplified ArtworkTemplatePreview used inside PDFPreviewContent.
            // The actual `content` prop is passed from ArtworkOverviewDialog which already contains the ArtworkPDFPreview component.
            // We need to ensure that the `content` prop (specifically `ArtworkPDFPreview`) is updated to not expect `templateStyle`.
          />
        </div>

        <DialogFooter className="p-4 border-t">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleApply}>Apply & Generate PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
