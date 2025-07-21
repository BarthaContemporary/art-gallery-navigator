
import React, { useState } from 'react';
import { Artwork } from '@/hooks/use-artworks';
import { Location } from '@/hooks/use-locations';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArtworkField } from './ArtworkField';
import { Check, X, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useArtists } from '@/hooks/useArtists';

interface ArtworkOverviewCollapsibleInfoProps {
  artwork: Artwork;
  location: Location | null | undefined;
  locationLoading: boolean;
}

export const ArtworkOverviewCollapsibleInfo: React.FC<ArtworkOverviewCollapsibleInfoProps> = ({ artwork, location, locationLoading }) => {
  const { toast } = useToast();
  const { data: artists } = useArtists();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const BooleanDisplay: React.FC<{value?: boolean | null}> = ({ value }) => 
    value ? <Check className="h-4 w-4 text-green-500 inline-block mr-1" /> : <X className="h-4 w-4 text-red-500 inline-block mr-1" />;

  const generateAIDescription = async () => {
    setIsGenerating(true);
    try {
      const artist = artists?.find(a => a.id === artwork.artist_id);
      
      const requestData = {
        title: artwork.title,
        artist_name: artist?.full_name,
        medium_type: artwork.medium_type,
        year: artwork.year,
        materials: artwork.materials,
        dimensions: artwork.dimensions,
        story: artwork.story,
      };

      const { data, error } = await supabase.functions.invoke('generate-artwork-description', {
        body: requestData
      });

      if (error) {
        throw new Error(`Function error: ${error.message || 'Unknown error'}`);
      }

      if (!data?.description) {
        throw new Error('No description returned from AI service');
      }

      // Update the artwork with new AI description
      const { error: updateError } = await supabase
        .from('artworks')
        .update({ ai_description: data.description })
        .eq('id', artwork.id);

      if (updateError) {
        throw new Error('Failed to save AI description');
      }

      toast({
        title: "AI Description Generated",
        description: "The AI description has been created successfully!",
      });

      // Reload the page to show the updated description
      window.location.reload();
    } catch (error: any) {
      console.error('Error generating AI description:', error);
      
      let errorMessage = "Failed to generate AI description. Please try again.";
      
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        errorMessage = "OpenAI API rate limit exceeded. Please try again later.";
      } else if (error.message?.includes('OPENAI_API_KEY')) {
        errorMessage = "OpenAI API key not configured. Please contact admin.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const formatFramingDetails = () => {
    if (!artwork.is_framed) return <><BooleanDisplay value={false} /><span>Not Framed</span></>;
    const dims = [
      artwork.frame_height ? `H ${artwork.frame_height}` : null,
      artwork.frame_width ? `W ${artwork.frame_width}` : null,
      artwork.frame_depth ? `D ${artwork.frame_depth}` : null,
    ].filter(Boolean).join(' x ');
    return <><BooleanDisplay value={true} /><span>Framed ({dims || 'Dimensions not specified'})</span></>;
  };

  const formatCrateDetails = () => {
    if (!artwork.has_crate) return <><BooleanDisplay value={false} /><span>No Crate</span></>;
    const dims = [
      artwork.crate_height ? `H ${artwork.crate_height}` : null,
      artwork.crate_width ? `W ${artwork.crate_width}` : null,
      artwork.crate_depth ? `D ${artwork.crate_depth}` : null,
    ].filter(Boolean).join(' x ');
    return <><BooleanDisplay value={true} /><span>Crated ({dims || 'Dimensions not specified'})</span></>;
  };
  
  return (
    <Accordion type="multiple" className="w-full text-sm">
      <AccordionItem value="location-status">
        <AccordionTrigger className="text-base font-medium">Location & Status</AccordionTrigger>
        <AccordionContent className="pt-2">
          <dl className="space-y-2">
            <ArtworkField label="Location" value={locationLoading ? "Loading..." : location?.name || 'N/A'} />
            <ArtworkField label="Status" value={<span className="capitalize">{artwork.status || 'N/A'}</span>} />
          </dl>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="framing-crate">
        <AccordionTrigger className="text-base font-medium">Framing, Crate & Weight</AccordionTrigger>
        <AccordionContent className="pt-2">
          <dl className="space-y-2">
            <ArtworkField label="Framing" value={formatFramingDetails()} />
            <ArtworkField label="Crate" value={formatCrateDetails()} />
            <ArtworkField label="Weight" value={artwork.weight ? `${artwork.weight} kg` : 'N/A'} /> {/* Assuming kg */}
          </dl>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="condition-signature">
        <AccordionTrigger className="text-base font-medium">Condition & Signature</AccordionTrigger>
        <AccordionContent className="pt-2">
          <dl className="space-y-2">
            <ArtworkField label="Condition" value={artwork.condition} multiline />
            <ArtworkField label="Signature Type" value={artwork.signature_type} />
            <ArtworkField label="Signature Details" value={artwork.signature_details} multiline />
          </dl>
        </AccordionContent>
      </AccordionItem>
      
      <AccordionItem value="ai-description">
        <AccordionTrigger className="text-base font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          AI Description
        </AccordionTrigger>
        <AccordionContent className="pt-2">
          <div className="space-y-3">
            {artwork.ai_description ? (
              <div>
                <ArtworkField label="" value={artwork.ai_description} multiline />
                <div className="mt-3">
                  <Button
                    onClick={generateAIDescription}
                    disabled={isGenerating}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Regenerate
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-3">No AI description generated yet</p>
                <Button
                  onClick={generateAIDescription}
                  disabled={isGenerating}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate AI Description
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
      
      <AccordionItem value="history-context">
        <AccordionTrigger className="text-base font-medium">History & Context</AccordionTrigger>
        <AccordionContent className="pt-2">
          <dl className="space-y-2">
            <ArtworkField label="Provenance" value={artwork.provenance} multiline />
            <ArtworkField label="Exhibition History" value={artwork.exhibition_history} multiline />
            <ArtworkField label="Story / Notes" value={artwork.story} multiline />
          </dl>
        </AccordionContent>
      </AccordionItem>
      
      {artwork.classification && artwork.classification !== "Unique" && (
         <AccordionItem value="classification-details">
          <AccordionTrigger className="text-base font-medium">Classification Specifics</AccordionTrigger>
          <AccordionContent className="pt-2">
            <dl className="space-y-2">
              <ArtworkField label="Classification" value={artwork.classification} />
              {/* Edition info is primarily in ArtworkOverviewPrimaryInfo for detail.
                  This section can be used for any other classification-specific fields if they exist.
                  For now, just showing classification again might be redundant if it's clear from primary info.
                  Alternatively, primary info edition could just be a summary, and full details here.
                  The current primary info is already quite detailed for edition.
                  Let's remove the classification field from here to avoid redundancy with primary info.
              */}
            </dl>
          </AccordionContent>
        </AccordionItem>
      )}
    </Accordion>
  );
};
