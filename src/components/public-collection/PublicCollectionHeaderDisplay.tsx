
import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import type { CollectionWebsite } from '@/types/collection-website';
// Removed Collection type import as it's not used after removing the alert
// import type { Collection } from '@/types/collection'; 
// import { Alert, AlertDescription, AlertTitle as ShadcnAlertTitle } from '@/components/ui/alert'; // No longer needed
// import { Info } from 'lucide-react'; // No longer needed


interface PublicCollectionHeaderDisplayProps {
  logoSrc: string;
  website: CollectionWebsite;
  // collection prop is not needed here as pageHeaderDescription handles all cases
  // collection: Collection | null | undefined; 
  // isCollectionLoading prop is not needed here as pageHeaderDescription handles all cases
  // isCollectionLoading: boolean; 
  // collectionError prop is not needed here as pageHeaderDescription handles all cases
  // collectionError: Error | null; 
  pageHeaderDescription: string;
}

export function PublicCollectionHeaderDisplay({
  logoSrc,
  website,
  // isCollectionLoading, // No longer directly used for conditional rendering here
  // collectionError, // No longer directly used for conditional rendering here
  pageHeaderDescription,
}: PublicCollectionHeaderDisplayProps) {
  // Props isCollectionLoading and collectionError are no longer passed to this component.
  // Their states are incorporated into `pageHeaderDescription` by the parent component `PublicCollectionView`.
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
      
      {/* The conditional div and Alert previously here were removed.
          The logic for displaying messages about collection loading status, errors, 
          or unavailability is now fully handled by the `pageHeaderDescription` prop,
          which is set in the parent `PublicCollectionView` component.
          This simplifies `PublicCollectionHeaderDisplay` and centralizes the logic.
      */}
    </>
  );
}

