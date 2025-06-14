
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
  collection,
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
      
      {website.collection_id && collection && !isCollectionLoading && !collectionError && (
        <div className="my-6 text-left border-t pt-6">
          {/* Content here is minimal as details are in PageHeader description */}
        </div>
      )}
      
      {website.collection_id && !collection && !isCollectionLoading && !collectionError && (
        <Alert variant="default" className="my-6">
          <Info className="h-5 w-5" />
          <ShadcnAlertTitle>Collection Information</ShadcnAlertTitle>
          <AlertDescription>The associated collection details could not be loaded.</AlertDescription>
        </Alert>
      )}
    </>
  );
}

