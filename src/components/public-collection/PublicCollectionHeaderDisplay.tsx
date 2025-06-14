
import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import type { CollectionWebsite } from '@/types/collection-website';
import type { Collection } from '@/types/collection'; // Corrected import path
import { Alert, AlertDescription, AlertTitle as ShadcnAlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';


interface PublicCollectionHeaderDisplayProps {
  logoSrc: string;
  website: CollectionWebsite;
  collection: Collection | null | undefined;
  isCollectionLoading: boolean;
  collectionError: Error | null;
  pageHeaderDescription: string;
}

export function PublicCollectionHeaderDisplay({
  logoSrc,
  website,
  // collection, // collection prop is no longer directly used for rendering conditional content here
  isCollectionLoading,
  collectionError,
  pageHeaderDescription,
}: PublicCollectionHeaderDisplayProps) {
  return (
    <>
      <div className="flex justify-start mb-6 sm:mb-8">
        <img 
          src={logoSrc} 
          alt="Gallery Logo" 
          className="h-auto"
          style={{ maxWidth: '250px' }}
        />
      </div>

      <PageHeader 
        title={website.name || `Collection Website: ${website.slug}`} 
        description={pageHeaderDescription}
      />
      
      {/* The conditional div below was removed as its content was handled by pageHeaderDescription */}
      {/* It previously checked for: website.collection_id && collection && !isCollectionLoading && !collectionError */}
      
      {website.collection_id && !website.collection_id && !isCollectionLoading && !collectionError && ( // This condition seems to be !collection, not !website.collection_id
        <Alert variant="default" className="my-6">
          <Info className="h-5 w-5" />
          <ShadcnAlertTitle>Collection Information</ShadcnAlertTitle>
          <AlertDescription>The associated collection details could not be loaded.</AlertDescription>
        </Alert>
      )}
    </>
  );
}
