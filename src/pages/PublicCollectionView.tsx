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

const LOGO_SRC = "https://cdn.prod.website-files.com/641c45e709414b1f712574c2/64242806807e29000ba8b7cc_bartha_logo.svg";

export default function PublicCollectionView() {
  const { slug } = useParams<{ slug: string }>();
  const { data: website, isLoading: isWebsiteLoading, error: websiteError } = useFetchPublicCollectionWebsite(slug);
  
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  const collectionId = website?.collection_id;
  const { data: collection, isLoading: isCollectionLoading, error: collectionError } = useFetchCollectionById(collectionId);
  const { data: artworks, isLoading: isArtworksLoading, error: artworksError } = useFetchArtworksByCollectionId(collectionId);

  useEffect(() => {
    if (!isWebsiteLoading && website) {
      console.log("Fetched website data:", website);
      console.log("Website collection_id:", website.collection_id);
    }
    if (collectionId && !isCollectionLoading && collection) {
      console.log("Fetched collection data:", collection);
    }
    if (collectionId && !isArtworksLoading && artworks) {
      console.log("Fetched artworks data:", artworks);
    }
  }, [website, isWebsiteLoading, collection, isCollectionLoading, artworks, isArtworksLoading, collectionId]);

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
        <img src={LOGO_SRC} alt="Gallery Logo" className="mb-8 h-auto" style={{ maxWidth: '300px' }} />
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading website...</p>
      </div>
    );
  }

  if (websiteError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <img src={LOGO_SRC} alt="Gallery Logo" className="mb-8 h-auto" style={{ maxWidth: '300px' }} />
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <PageHeader title="Error" description={`Failed to load website: ${websiteError.message}`} />
      </div>
    );
  }

  if (!website) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <img src={LOGO_SRC} alt="Gallery Logo" className="mb-8 h-auto" style={{ maxWidth: '300px' }} />
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <PageHeader title="Not Found" description="The requested collection website could not be found or is not active." />
      </div>
    );
  }

  if (website.password_hash && !isPasswordVerified) {
    return (
      <div className="flex flex-col items-center justify-start min-h-screen p-4 pt-10">
        <img src={LOGO_SRC} alt="Gallery Logo" className="mb-8 h-auto" style={{ maxWidth: '300px' }} />
        <PasswordProtectView websiteSlug={website.slug} onVerified={handlePasswordVerified} />
      </div>
    );
  }
  
  let pageHeaderDescription = "This website is not currently associated with a specific collection.";
  if (website.collection_id) {
    if (isCollectionLoading) {
      pageHeaderDescription = "Loading collection information...";
    } else if (collectionError) {
      pageHeaderDescription = `Error loading collection: ${collectionError.message}`;
    } else if (collection) {
      pageHeaderDescription = `${collection.name}${collection.description ? `: ${collection.description}` : ''}`;
    } else {
      pageHeaderDescription = "Attached collection details are currently unavailable.";
    }
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="flex justify-start mb-6 sm:mb-8"> {/* Changed justify-center to justify-start */}
        <img 
          src={LOGO_SRC} 
          alt="Gallery Logo" 
          className="h-auto"
          style={{ maxWidth: '300px' }} // Changed maxWidth to 300px
        />
      </div>

      <PageHeader 
        title={website.name || `Collection Website: ${website.slug}`} 
        description={pageHeaderDescription}
      />
      
      {/* Section for Collection Title and Description - This might be redundant now as it's in PageHeader description */}
      {/* We'll keep this for now but simplify it, ensuring it only shows if collection is loaded successfully */}
      {website.collection_id && collection && !isCollectionLoading && !collectionError && (
        <div className="my-6 text-left border-t pt-6">
          {/* Title is now mainly in PageHeader, description too, but we can keep this as a detailed view if desired */}
          {/* For now, let's remove the redundant title and description from here as they are in pageHeaderDescription */}
        </div>
      )}
      
      {/* Display a message if collection_id is present but collection couldn't be loaded and wasn't an error caught by collectionError */}
      {website.collection_id && !collection && !isCollectionLoading && !collectionError && (
        <Alert variant="default" className="my-6">
          <Info className="h-5 w-5" />
          <ShadcnAlertTitle>Collection Information</ShadcnAlertTitle>
          <AlertDescription>The associated collection details could not be loaded.</AlertDescription>
        </Alert>
      )}
      
      {website.collection_id ? (
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
                 { collectionId ? "This collection currently has no artworks, or they could not be loaded." : "No collection is linked to this website, so no artworks can be displayed."}
               </p>
             </div>
          )}
        </div>
      ) : (
        <div className="mt-8 text-center text-muted-foreground">
          <Info className="h-8 w-8 mx-auto mb-2 text-primary" />
          <p>Artworks cannot be displayed as no collection is linked to this website.</p>
        </div>
      )}
    </div>
  );
}
