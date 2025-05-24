import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useFetchPublicCollectionWebsite } from '@/hooks/collection-websites';
import { useFetchCollectionById } from '@/hooks/collections';
import { useFetchArtworksByCollectionId } from '@/hooks/artworks';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertDescription, AlertTitle as ShadcnAlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2, Info } from 'lucide-react';
import { PasswordProtectView } from '@/components/public-collection/PasswordProtectView';
import { ArtworkCard } from '@/components/artworks/ArtworkCard';

export default function PublicCollectionView() {
  const { slug } = useParams<{ slug: string }>();
  const { data: website, isLoading: isWebsiteLoading, error: websiteError } = useFetchPublicCollectionWebsite(slug);
  
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  const { data: collection, isLoading: isCollectionLoading, error: collectionError } = useFetchCollectionById(website?.collection_id);
  const { data: artworks, isLoading: isArtworksLoading, error: artworksError } = useFetchArtworksByCollectionId(website?.collection_id);

  useEffect(() => {
    if (website && slug) {
      const storedVerification = sessionStorage.getItem(`pwd_verified_${slug}`);
      if (storedVerification === 'true') {
        setIsPasswordVerified(true);
      }
    }
    setSessionChecked(true);
  }, [website, slug]);

  const handlePasswordVerified = () => {
    setIsPasswordVerified(true);
    if (slug) {
      sessionStorage.setItem(`pwd_verified_${slug}`, 'true');
    }
  };

  if (isWebsiteLoading || !sessionChecked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading website...</p>
      </div>
    );
  }

  if (websiteError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <PageHeader title="Error" description={`Failed to load website: ${websiteError.message}`} />
      </div>
    );
  }

  if (!website) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <PageHeader title="Not Found" description="The requested collection website could not be found or is not active." />
      </div>
    );
  }

  if (website.password_hash && !isPasswordVerified) {
    return <PasswordProtectView websiteSlug={website.slug} onVerified={handlePasswordVerified} />;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <PageHeader 
        title={website.name || `Collection Website: ${website.slug}`} 
        description="Explore the content of this shared collection website."
      />

      {/* Section for Collection Title and Description */}
      {isCollectionLoading && (
        <div className="my-6 text-center">
          <Loader2 className="mr-2 h-6 w-6 animate-spin inline-block text-primary" />
          <p className="text-muted-foreground inline-block">Loading collection information...</p>
        </div>
      )}
      {collectionError && (
        <Alert variant="destructive" className="my-6">
          <AlertTriangle className="h-5 w-5" />
          <ShadcnAlertTitle>Error Loading Collection</ShadcnAlertTitle>
          <AlertDescription>{collectionError.message}</AlertDescription>
        </Alert>
      )}
      {collection && !isCollectionLoading && !collectionError && (
        <div className="my-6 text-left">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            {collection.name}
          </h2>
          {collection.description && (
            <p className="mt-2 text-md text-muted-foreground">
              {collection.description}
            </p>
          )}
        </div>
      )}
      
      {/* Artworks Section - moved out of the Card component */}
      <div className="mt-8">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">Artworks</h2>
        {isArtworksLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
            <p className="text-muted-foreground">Loading artworks...</p>
          </div>
        )}
        {artworksError && (
          <Alert variant="destructive" className="my-6">
            <AlertTriangle className="h-5 w-5" />
            <ShadcnAlertTitle>Error Loading Artworks</ShadcnAlertTitle>
            <AlertDescription>
              Failed to load artworks: {artworksError.message}
            </AlertDescription>
          </Alert>
        )}
        {!isArtworksLoading && !artworksError && artworks && artworks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6">
            {artworks.map(artwork => (
              <ArtworkCard key={artwork.id} artwork={artwork} />
            ))}
          </div>
        )}
        {!isArtworksLoading && !artworksError && (!artworks || artworks.length === 0) && (
           <div className="mt-6 p-6 border rounded-md bg-muted/50 text-muted-foreground flex flex-col items-center text-center">
             <Info className="h-10 w-10 mb-3 text-primary" />
             <p className="text-lg font-medium">No Artworks to Display</p>
             <p className="text-sm">
               No artworks found in this collection, or they could not be loaded at this time.
             </p>
           </div>
        )}
      </div>
    </div>
  );
}
