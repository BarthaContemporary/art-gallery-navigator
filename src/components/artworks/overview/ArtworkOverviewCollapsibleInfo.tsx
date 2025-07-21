
import React from 'react';
import { Artwork } from '@/hooks/use-artworks';
import { Location } from '@/hooks/use-locations';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArtworkField } from './ArtworkField';
import { Check, X } from 'lucide-react';

interface ArtworkOverviewCollapsibleInfoProps {
  artwork: Artwork;
  location: Location | null | undefined;
  locationLoading: boolean;
}

export const ArtworkOverviewCollapsibleInfo: React.FC<ArtworkOverviewCollapsibleInfoProps> = ({ artwork, location, locationLoading }) => {
  
  const BooleanDisplay: React.FC<{value?: boolean | null}> = ({ value }) => 
    value ? <Check className="h-4 w-4 text-green-500 inline-block mr-1" /> : <X className="h-4 w-4 text-red-500 inline-block mr-1" />;

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
