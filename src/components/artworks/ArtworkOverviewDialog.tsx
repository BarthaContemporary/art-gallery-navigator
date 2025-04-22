
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Edit, FileText } from "lucide-react";
import { Artwork } from "@/hooks/use-artworks";
import { ArtworkCarousel } from "./ArtworkCarousel";
import { useState } from "react";
import { EditArtworkDialog } from "./EditArtworkDialog";
import { useToast } from "@/hooks/use-toast";
import { createArtworkPDF } from "@/lib/create-artwork-pdf";
import { supabase } from "@/integrations/supabase/client";

interface ArtworkOverviewDialogProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArtworkOverviewDialog({ artwork, open, onOpenChange }: ArtworkOverviewDialogProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleCreatePDF = async () => {
    try {
      toast({ title: "Creating PDF...", description: "Please wait a moment" });
      const pdfUrl = await createArtworkPDF(artwork);
      
      // Save to documents table
      const { error } = await supabase.from("documents").insert({
        file_name: `${artwork.title} - Overview.pdf`,
        file_url: pdfUrl,
        type: "artwork_overview",
        description: `Overview document for ${artwork.title}`,
        artwork_id: artwork.id
      });

      if (error) throw error;
      
      toast({ 
        title: "PDF Created Successfully", 
        description: "The document has been saved to your documents library" 
      });
    } catch (error) {
      console.error("Error creating PDF:", error);
      toast({ 
        title: "Error Creating PDF", 
        description: "Please try again later", 
        variant: "destructive" 
      });
    }
  };
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="text-2xl">{artwork.title}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-8">
            {/* Carousel */}
            <ArtworkCarousel artworkId={artwork.id} />
            
            {/* Artwork Details */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Artwork Information</h3>
                  <dl className="space-y-2">
                    <div className="flex flex-col">
                      <dt className="text-sm font-medium text-muted-foreground">Artist</dt>
                      <dd>{artwork.artist_id}</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-sm font-medium text-muted-foreground">Year</dt>
                      <dd>{artwork.year}</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-sm font-medium text-muted-foreground">Medium Type</dt>
                      <dd>{artwork.medium_type}</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-sm font-medium text-muted-foreground">Materials</dt>
                      <dd>{artwork.materials}</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-sm font-medium text-muted-foreground">Classification</dt>
                      <dd>{artwork.classification}</dd>
                    </div>
                    {artwork.classification !== 'Unique' && (
                      <>
                        <div className="flex flex-col">
                          <dt className="text-sm font-medium text-muted-foreground">Edition Size</dt>
                          <dd>{artwork.edition_size || 'N/A'}</dd>
                        </div>
                        <div className="flex flex-col">
                          <dt className="text-sm font-medium text-muted-foreground">Available Works</dt>
                          <dd>{artwork.available_works || 0}</dd>
                        </div>
                        <div className="flex flex-col">
                          <dt className="text-sm font-medium text-muted-foreground">Inventory Quantity</dt>
                          <dd>{artwork.inventory_quantity || 0}</dd>
                        </div>
                        <div className="flex flex-col">
                          <dt className="text-sm font-medium text-muted-foreground">Artist Proofs</dt>
                          <dd>{artwork.artist_proofs || 0}</dd>
                        </div>
                      </>
                    )}
                  </dl>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-4">Dimensions & Physical Details</h3>
                  <dl className="space-y-2">
                    <div className="flex flex-col">
                      <dt className="text-sm font-medium text-muted-foreground">Dimensions</dt>
                      <dd>{artwork.dimensions}</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-sm font-medium text-muted-foreground">Height × Width × Depth</dt>
                      <dd>{artwork.height || 'N/A'} × {artwork.width || 'N/A'} × {artwork.depth || 'N/A'} cm</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-sm font-medium text-muted-foreground">Price</dt>
                      <dd>{artwork.price ? `${artwork.currency} ${artwork.price.toLocaleString()}` : 'N/A'}</dd>
                    </div>
                    
                    <div className="flex flex-col">
                      <dt className="text-sm font-medium text-muted-foreground">Framed</dt>
                      <dd>{artwork.is_framed ? 'Yes' : 'No'}</dd>
                    </div>
                    
                    {artwork.is_framed && (
                      <div className="flex flex-col">
                        <dt className="text-sm font-medium text-muted-foreground">Frame Dimensions (H×W×D)</dt>
                        <dd>{artwork.frame_height || 'N/A'} × {artwork.frame_width || 'N/A'} × {artwork.frame_depth || 'N/A'} cm</dd>
                      </div>
                    )}
                    
                    <div className="flex flex-col">
                      <dt className="text-sm font-medium text-muted-foreground">Weight</dt>
                      <dd>{artwork.weight ? `${artwork.weight} kg` : 'N/A'}</dd>
                    </div>
                    
                    <div className="flex flex-col">
                      <dt className="text-sm font-medium text-muted-foreground">Has Crate</dt>
                      <dd>{artwork.has_crate ? 'Yes' : 'No'}</dd>
                    </div>
                    
                    {artwork.has_crate && (
                      <div className="flex flex-col">
                        <dt className="text-sm font-medium text-muted-foreground">Crate Dimensions (H×W×D)</dt>
                        <dd>{artwork.crate_height || 'N/A'} × {artwork.crate_width || 'N/A'} × {artwork.crate_depth || 'N/A'} cm</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-4">Additional Information</h3>
                <dl className="space-y-2">
                  <div className="flex flex-col">
                    <dt className="text-sm font-medium text-muted-foreground">Condition</dt>
                    <dd>{artwork.condition || 'N/A'}</dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="text-sm font-medium text-muted-foreground">Signature</dt>
                    <dd>{artwork.signature_type || 'N/A'}</dd>
                  </div>
                  {artwork.signature_details && (
                    <div className="flex flex-col">
                      <dt className="text-sm font-medium text-muted-foreground">Signature Details</dt>
                      <dd>{artwork.signature_details}</dd>
                    </div>
                  )}
                  {artwork.provenance && (
                    <div className="flex flex-col">
                      <dt className="text-sm font-medium text-muted-foreground">Provenance</dt>
                      <dd>{artwork.provenance}</dd>
                    </div>
                  )}
                  {artwork.story && (
                    <div className="flex flex-col">
                      <dt className="text-sm font-medium text-muted-foreground">Story</dt>
                      <dd>{artwork.story}</dd>
                    </div>
                  )}
                  {artwork.exhibition_history && (
                    <div className="flex flex-col">
                      <dt className="text-sm font-medium text-muted-foreground">Exhibition History</dt>
                      <dd>{artwork.exhibition_history}</dd>
                    </div>
                  )}
                </dl>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-4">Location & Status</h3>
                <dl className="space-y-2">
                  <div className="flex flex-col">
                    <dt className="text-sm font-medium text-muted-foreground">Location</dt>
                    <dd>{artwork.location_id || 'N/A'}</dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                    <dd className="capitalize">{artwork.status || 'N/A'}</dd>
                  </div>
                </dl>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                <X className="mr-2 h-4 w-4" />
                Close
              </Button>
              <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button onClick={handleCreatePDF}>
                <FileText className="mr-2 h-4 w-4" />
                Create PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <EditArtworkDialog 
        artwork={artwork}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </>
  );
}
